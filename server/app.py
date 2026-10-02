"""Compose the local API and serve the frozen desktop UI."""
import os
import sys
from pathlib import Path
from typing import Any
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from server.config import SERVER_DIR
from server.services.dictionary import tomoshi_is_available
from server.routes import annotation, artwork, dictionary, settings, ai

app = FastAPI(title="UTA annotation API", version="0.3.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"], allow_methods=["*"], allow_headers=["*"],
)

@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "application": "uta-japanese-song-learning",
        "tomoshi_dictionary": tomoshi_is_available(),
    }

for router in (annotation.router, artwork.router, dictionary.router, settings.router, ai.router):
    app.include_router(router)

def packaged_static_directory() -> Path:
    """Locate the Vite build both in source checkouts and PyInstaller bundles."""
    configured = os.environ.get("UTA_STATIC_DIR")
    if configured:
        return Path(configured)
    bundle_root = Path(getattr(sys, "_MEIPASS", SERVER_DIR.parent))
    return bundle_root / "dist"


STATIC_DIRECTORY = packaged_static_directory()
if STATIC_DIRECTORY.is_dir():
    # Keep this mount last so every /api route above retains priority.
    app.mount("/", StaticFiles(directory=STATIC_DIRECTORY, html=True), name="web")
