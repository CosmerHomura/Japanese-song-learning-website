"""Local tokenization and explicit word-boundary reparsing."""
import threading
from functools import lru_cache
from fastapi import HTTPException
from sudachipy import dictionary, tokenizer
from server.schemas import AnnotationToken
from server.services.japanese import kata_to_hira, has_kanji, split_ruby
from server.services.dictionary import lookup_tomoshi_word
from server.services.lexicon import WORD_LEXICON, GRAMMAR_PHRASES

def refresh_dictionary_meanings(lines):
    result = []
    for line in lines:
        tokens = line.tokens or []
        if ''.join(token.surface for token in tokens) != line.text:
            raise HTTPException(422, "词素与歌词不匹配，无法刷新词义。")
        entries = []
        for token in tokens:
            candidates = tuple(dict.fromkeys([token.dictionary_form or token.surface, token.surface]))
            entry = next((WORD_LEXICON[word] for word in candidates if word in WORD_LEXICON), None)
            if not entry and not token.is_symbol:
                entry = lookup_tomoshi_word(candidates, token.reading, token.part_of_speech)
            entries.append({"index": token.index, "surface": token.surface, "meaning": entry["meaning"] if entry else None, "examples": entry["examples"] if entry else []})
        result.append({"id": line.id, "tokens": entries})
    return result

def parse_explicit_segments(text: str, segments: list[str]) -> list[dict]:
    if not segments or any(not isinstance(item, str) or not item for item in segments) or "".join(segments) != text:
        raise HTTPException(status_code=422, detail="分词只能调整边界，不能增删或修改原歌词（包括空格）。")
    result = []
    for index, surface in enumerate(segments):
        automatic = annotate_text(surface)
        token = automatic[0].model_dump()
        exact = len(automatic) == 1 and automatic[0].surface == surface
        reading = token["reading"] if exact else "".join(item.reading for item in automatic)
        base, ruby, suffix = split_ruby(surface, reading) if has_kanji(surface) and reading else (surface, "", "")
        candidates = tuple(dict.fromkeys([surface, token["dictionary_form"]] if exact else [surface]))
        entry = next((WORD_LEXICON[value] for value in candidates if value in WORD_LEXICON), None) or lookup_tomoshi_word(candidates, reading, token["part_of_speech"] if exact else "")
        if not entry and exact and token["meaning"]:
            entry = {"meaning": token["meaning"], "examples": token["examples"]}
        token.update(index=index, surface=surface, reading=reading, base=base, ruby=ruby, suffix=suffix,
                     dictionary_form=token["dictionary_form"] if exact else surface, normalized_form=surface,
                     meaning=entry["meaning"] if entry else None, examples=entry["examples"] if entry else [],
                     needs_review=not exact, dictionary_source="本地词典 / 内置规则" if entry else "未命中词典；读音仅为自动初稿")
        result.append(token)
    return result

@lru_cache(maxsize=1)
def get_tokenizer():
    return dictionary.Dictionary().tokenizer()


TOKENIZER_LOCK = threading.Lock()


def annotate_text(text: str) -> list[AnnotationToken]:
    # Sudachi's shared Rust tokenizer cannot be borrowed by two worker threads.
    # Hold the lock while consuming morphemes as well as calling tokenize().
    with TOKENIZER_LOCK:
        return _annotate_text_locked(text)


def _annotate_text_locked(text: str) -> list[AnnotationToken]:
    sudachi = get_tokenizer()
    mode = tokenizer.Tokenizer.SplitMode.C
    result: list[AnnotationToken] = []

    for index, morpheme in enumerate(sudachi.tokenize(text, mode)):
        surface = morpheme.surface()
        raw_reading = morpheme.reading_form()
        reading = kata_to_hira(raw_reading) if raw_reading and raw_reading != "*" else ""
        dictionary_form = morpheme.dictionary_form() or surface
        if dictionary_form == "*":
            dictionary_form = surface
        normalized_form = morpheme.normalized_form() or dictionary_form
        if normalized_form == "*":
            normalized_form = dictionary_form
        pos_values = morpheme.part_of_speech()
        inflection_type = pos_values[4] if len(pos_values) > 4 and pos_values[4] != "*" else "无活用"
        inflection_form = pos_values[5] if len(pos_values) > 5 and pos_values[5] != "*" else "基本形"
        # Sudachi returns spaces and punctuation as morphemes.  In particular, a
        # plain space can have the reading "記号", which previously leaked into
        # the learner-facing reading line as "きごう".  Keep the character for
        # the original lyric, but never treat it as a word or give it a reading.
        is_symbol = not any(character.isalnum() for character in surface)
        if is_symbol:
            result.append(AnnotationToken(
                index=index, surface=surface, reading="", is_symbol=True,
                base=surface, ruby="", suffix="", part_of_speech="・".join(pos_values[:2]),
                dictionary_form=surface, normalized_form=surface,
                inflection_type=inflection_type, inflection_form=inflection_form,
                meaning=None, examples=[], needs_review=False,
            ))
            continue
        word_entry = WORD_LEXICON.get(dictionary_form) or WORD_LEXICON.get(normalized_form) or WORD_LEXICON.get(surface)
        if not word_entry:
            lookup_candidates = tuple(dict.fromkeys(
                value for value in (dictionary_form, normalized_form, surface) if value and value != "*"
            ))
            word_entry = lookup_tomoshi_word(lookup_candidates, reading, pos_values[0] if pos_values else "")
        contains_kanji = has_kanji(surface)
        base, ruby, suffix = split_ruby(surface, reading) if contains_kanji and reading else (surface, "", "")
        result.append(AnnotationToken(
            index=index, surface=surface, reading=reading or surface, base=base, ruby=ruby, suffix=suffix,
            part_of_speech="・".join(pos_values[:2]), dictionary_form=dictionary_form,
            normalized_form=normalized_form, inflection_type=inflection_type, inflection_form=inflection_form,
            meaning=word_entry["meaning"] if word_entry else None,
            examples=word_entry["examples"] if word_entry else [], needs_review=contains_kanji and not bool(reading),
        ))
    return merge_grammar_phrases(merge_calendar_months(result))


def merge_calendar_months(tokens: list[AnnotationToken]) -> list[AnnotationToken]:
    readings = {1: "いちがつ", 2: "にがつ", 3: "さんがつ", 4: "しがつ", 5: "ごがつ", 6: "ろくがつ", 7: "しちがつ", 8: "はちがつ", 9: "くがつ", 10: "じゅうがつ", 11: "じゅういちがつ", 12: "じゅうにがつ"}
    kanji_numbers = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10, "十一": 11, "十二": 12}
    merged = []
    index = 0
    while index < len(tokens):
        surface = tokens[index].surface.translate(str.maketrans("０１２３４５６７８９", "0123456789"))
        number = int(surface) if surface.isascii() and surface.isdigit() else kanji_numbers.get(surface)
        if number in readings and index + 1 < len(tokens) and tokens[index + 1].surface == "月" and not (index + 2 < len(tokens) and tokens[index + 2].surface == "間"):
            combined = tokens[index].surface + "月"
            merged.append(tokens[index].model_copy(update={"surface": combined, "reading": readings[number], "base": combined, "ruby": readings[number], "suffix": "", "dictionary_form": combined, "normalized_form": combined, "meaning": f"{number}月；月份表达", "examples": [], "part_of_speech": "名词・月份", "needs_review": False}))
            index += 2
        else:
            merged.append(tokens[index])
            index += 1
    return merged


def merge_grammar_phrases(tokens: list[AnnotationToken]) -> list[AnnotationToken]:
    """Merge high-frequency grammar expressions that a morphological parser splits apart."""
    merged: list[AnnotationToken] = []
    index = 0
    while index < len(tokens):
        matched = False
        for parts, definition in GRAMMAR_PHRASES.items():
            candidate = tokens[index:index + len(parts)]
            if tuple(token.surface for token in candidate) != parts:
                continue
            merged.append(AnnotationToken(
                index=len(merged), surface=definition["surface"], reading=definition["reading"],
                base=definition["surface"], ruby="", suffix="", part_of_speech=definition["part_of_speech"],
                dictionary_form=definition["surface"], normalized_form=definition["surface"],
                inflection_type="无活用", inflection_form="语法表达", meaning=definition["meaning"],
                examples=definition["examples"], needs_review=False,
            ))
            index += len(parts)
            matched = True
            break
        if not matched:
            merged.append(tokens[index].model_copy(update={"index": len(merged)}))
            index += 1
    return merged
