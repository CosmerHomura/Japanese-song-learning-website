"""Japanese script and ruby helpers."""
def kata_to_hira(value: str) -> str:
    return "".join(chr(ord(char) - 0x60) if "ァ" <= char <= "ヶ" else char for char in value)


def has_kanji(value: str) -> bool:
    return any("\u3400" <= char <= "\u9fff" or char == "々" for char in value)


def is_kana(char: str) -> bool:
    return "ぁ" <= char <= "ゖ" or "ァ" <= char <= "ヶ" or char == "ー"


def split_ruby(surface: str, reading: str) -> tuple[str, str, str]:
    """Split a token into ruby base, ruby reading and okurigana suffix."""
    suffix_length = 0
    for index in range(1, min(len(surface), len(reading)) + 1):
        if surface[-index] == reading[-index] and is_kana(surface[-index]):
            suffix_length = index
        else:
            break
    base = surface[:-suffix_length] if suffix_length else surface
    suffix = surface[-suffix_length:] if suffix_length else ""
    ruby = reading[:-suffix_length] if suffix_length else reading
    return base, ruby, suffix
