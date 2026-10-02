"""Shared validation for AI text and metadata-only lyric lines."""
import re
import unicodedata
from typing import Any
from server.services.japanese import is_kana

def is_valid_reading(reading: str) -> bool:
    return bool(reading) and len(reading) <= 100 and all(is_kana(char) or char in "・' 　" for char in reading)


def text_field(value: Any, *, limit: int = 240) -> str:
    return value.strip()[:limit] if isinstance(value, str) else ""


def song_heading_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    normalized = re.sub(r"\([^)]*\)|（[^）]*）|【[^】]*】|\[[^\]]*\]", "", normalized)
    normalized = re.sub(r"\s+", "", normalized).casefold()
    return re.sub(r"[‐‑‒–—－]", "-", normalized)


def is_song_heading_line(text: str, title: str, artist: str) -> bool:
    if re.match(r"^(?:歌名|歌曲名|曲名|歌曲|歌手|歌唱|演唱|アーティスト|artist|singer|vocal|title|song)\s*[:：]", text.strip(), re.I):
        return True
    heading = song_heading_key(text)
    title_key = song_heading_key(title)
    artist_key = song_heading_key(artist)
    if not title_key or not artist_key:
        return False
    return any(heading in (f"{title_key}{separator}{artist_key}", f"{artist_key}{separator}{title_key}")
               for separator in ("-", "·", "・", "/", "|", "｜"))
