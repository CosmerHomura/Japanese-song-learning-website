from fastapi import APIRouter, HTTPException
from server.services.artwork import find_song_artwork
from server.services.lyric_context import text_field

router = APIRouter()
@router.get("/api/artwork/search")
def search_song_artwork(title: str, artist: str = "") -> dict[str, str]:
    """Return the closest Apple Music cover match, or an empty object on a safe miss."""
    safe_title = text_field(title, limit=160)
    safe_artist = text_field(artist, limit=160)
    if not safe_title:
        raise HTTPException(status_code=422, detail="歌曲名不能为空")
    return find_song_artwork(safe_title, safe_artist)
