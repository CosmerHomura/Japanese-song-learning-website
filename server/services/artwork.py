"""Public artwork lookup, independent of API routing and local settings."""

import json
import re
from typing import Any
from urllib import error as urllib_error, parse as urllib_parse, request as urllib_request


def artwork_search_key(value: str) -> str:
    """Make a forgiving comparison key for Japanese, Latin, and spaced metadata."""
    return "".join(character for character in value.casefold() if character.isalnum())


def artwork_title_candidates(title: str) -> list[str]:
    """Return likely catalog titles after removing common LRC release annotations."""
    original = re.sub(r"\s+", " ", title).strip()
    candidates = [original]
    for separator in ("≫", "»", "｜", "|", "／"):
        if separator in original:
            candidates.append(original.split(separator, 1)[0].strip())
    candidates.append(re.sub(r"\s*[（(\[【〈《].*$", "", original).strip())
    candidates.append(re.split(
        r"\s+(?:TV(?:\s*SIZE|\s*VER(?:SION)?|\s*EDIT)?|ANIME|アニメ|挿入歌|主題歌|OP|ED)\b",
        original,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0].strip())
    return list(dict.fromkeys(candidate for candidate in candidates if candidate))


def artwork_match_score(result: dict[str, Any], title: str, artist: str) -> int:
    """Prefer the result whose track and artist names best match the LRC metadata."""
    title_key = artwork_search_key(title)
    artist_key = artwork_search_key(artist)
    track_key = artwork_search_key(str(result.get("trackName", "")))
    result_artist_key = artwork_search_key(str(result.get("artistName", "")))
    score = 0
    if title_key and track_key:
        score += 8 if title_key == track_key else 3 if title_key in track_key or track_key in title_key else 0
    if artist_key and result_artist_key:
        score += 5 if artist_key == result_artist_key else 2 if artist_key in result_artist_key or result_artist_key in artist_key else 0
    return score


def fetch_itunes_songs(query: str) -> list[dict[str, Any]]:
    if not query:
        return []
    params = urllib_parse.urlencode({
        "term": query,
        "country": "JP",
        "media": "music",
        "entity": "song",
        "limit": "12",
    })
    http_request = urllib_request.Request(
        f"https://itunes.apple.com/search?{params}",
        headers={"Accept": "application/json", "User-Agent": "UTA-Japanese-Song-Learning/0.1"},
    )
    try:
        with urllib_request.urlopen(http_request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (OSError, ValueError, urllib_error.URLError, urllib_error.HTTPError, UnicodeDecodeError):
        return []
    results = payload.get("results", []) if isinstance(payload, dict) else []
    return [item for item in results if isinstance(item, dict) and item.get("artworkUrl100")]


def find_song_artwork(title: str, artist: str = "") -> dict[str, str]:
    """Look up public store artwork without exposing this external API to the browser."""
    titles = artwork_title_candidates(title)
    if not titles:
        return {}
    search_title = min(titles, key=len)
    queries = [" ".join(part for part in (search_title, artist) if part).strip(), search_title]
    candidates: list[dict[str, Any]] = []
    for query in dict.fromkeys(queries):
        candidates.extend(fetch_itunes_songs(query))
        if candidates:
            best_score = max(max(artwork_match_score(item, candidate, artist) for candidate in titles) for item in candidates)
            if best_score >= 8:
                break
    if not candidates:
        return {}
    match = max(candidates, key=lambda item: max(artwork_match_score(item, candidate, artist) for candidate in titles))
    match_score = max(artwork_match_score(match, candidate, artist) for candidate in titles)
    if match_score < 3:
        return {}
    artwork_url = str(match.get("artworkUrl100", "")).replace("100x100bb", "600x600bb")
    source_url = str(match.get("trackViewUrl") or match.get("collectionViewUrl") or "")
    return {"artwork_url": artwork_url, "source_url": source_url, "provider": "Apple Music"}
