"""Read-only dictionary queries, cached by installed database revision."""
import json
import sqlite3
import threading
from functools import lru_cache
from typing import Any
from server.config import TOMOSHI_DB_PATH
from server.services.japanese import kata_to_hira

DICTIONARY_LOCK = threading.RLock()
def tomoshi_is_available() -> bool:
    return TOMOSHI_DB_PATH.is_file()


def get_tomoshi_connection() -> sqlite3.Connection | None:
    """The caller closes this connection before another dictionary installs."""
    if not tomoshi_is_available():
        return None
    database_uri = f"{TOMOSHI_DB_PATH.resolve().as_uri()}?mode=ro"
    return sqlite3.connect(database_uri, uri=True)


def reading_matches_entry(entry_data: str, reading: str) -> bool:
    """Prefer a homograph whose registered kana agrees with Sudachi's reading."""
    if not reading:
        return False
    try:
        kana_forms = json.loads(entry_data).get("kana", [])
    except (TypeError, json.JSONDecodeError):
        return False
    return any(
        isinstance(item, dict) and kata_to_hira(str(item.get("text", ""))) == reading
        for item in kana_forms
    )


TOMOSHI_POS_HINTS = {
    "代名詞": ("pronoun",),
    "助詞": ("particle",),
    "助動詞": ("auxiliary", "copula"),
    "接続詞": ("conjunction",),
    "感動詞": ("interjection",),
    "接頭辞": ("prefix",),
    "接尾辞": ("suffix",),
    "連体詞": ("pre-noun", "adjectival"),
    "形状詞": ("adjectival",),
    "形容詞": ("adjective",),
    "副詞": ("adverb",),
    "動詞": ("verb",),
    "名詞": ("noun",),
}


def entry_matches_sudachi_pos(entry_data: str, sudachi_pos: str) -> bool:
    """Disambiguate kana homographs such as の (particle) versus 野 (field)."""
    hints = next((value for label, value in TOMOSHI_POS_HINTS.items() if label in sudachi_pos), ())
    if not hints:
        return False
    try:
        senses = json.loads(entry_data).get("senses", [])
    except (TypeError, json.JSONDecodeError):
        return False
    labels = " ".join(
        str(label).lower()
        for sense in senses if isinstance(sense, dict)
        for label in sense.get("pos", [])
    )
    return any(hint in labels for hint in hints)


def extract_chinese_meaning(definition_data: str | None) -> str:
    """Extract a compact, learner-friendly gloss from Tomoshi's zh_defs JSON."""
    if not definition_data:
        return ""
    try:
        senses = json.loads(definition_data).get("senses", {})
    except (TypeError, json.JSONDecodeError):
        return ""
    if not isinstance(senses, (dict, list)):
        return ""
    sense_values = senses.values() if isinstance(senses, dict) else senses
    for sense in sense_values:
        if not isinstance(sense, dict):
            continue
        for gloss in sense.get("glosses", []):
            text = gloss.get("text", "").strip() if isinstance(gloss, dict) else ""
            if text:
                return text
    return ""


def lookup_tomoshi_word(candidates: tuple[str, ...], reading: str, sudachi_pos: str) -> dict[str, Any] | None:
    with DICTIONARY_LOCK:
        try:
            revision = TOMOSHI_DB_PATH.stat()
        except OSError:
            return None
        return _lookup_installed_word(candidates, reading, sudachi_pos, (revision.st_mtime_ns, revision.st_size, revision.st_ino))


@lru_cache(maxsize=20_000)
def _lookup_installed_word(candidates: tuple[str, ...], reading: str, sudachi_pos: str, revision: tuple[int, int, int]) -> dict[str, Any] | None:
    """Find the most useful common Chinese definition for a parsed token."""
    connection = get_tomoshi_connection()
    if connection is None:
        return None

    query = """
        SELECT e.is_common, f.is_common, z.data, e.data, COALESCE(freq.rank, 999999)
        FROM forms AS f
        JOIN entries AS e ON e.id = f.entry_id
        LEFT JOIN zh_defs AS z ON z.entry_id = e.id AND z.locale = 'zh-CN'
        LEFT JOIN freq_rank AS freq ON freq.entry_id = e.id
        WHERE f.text = ?
        ORDER BY e.is_common DESC, f.is_common DESC, COALESCE(freq.rank, 999999) ASC
        LIMIT 12
    """
    try:
        for candidate in candidates:
            rows = connection.execute(query, (candidate,)).fetchall()
            if not rows:
                continue
            reading_rows = [row for row in rows if reading_matches_entry(row[3], reading)]
            pos_rows = [row for row in (reading_rows or rows) if entry_matches_sudachi_pos(row[3], sudachi_pos)]
            for row in pos_rows or reading_rows or rows:
                meaning = extract_chinese_meaning(row[2])
                if meaning:
                    return {"meaning": meaning, "examples": []}
        return None
    except sqlite3.Error:
        return None
    finally:
        connection.close()
