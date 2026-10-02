"""Shared local paths and desktop session configuration."""
import os
from pathlib import Path
from dotenv import load_dotenv

SERVER_DIR = Path(__file__).resolve().parent
CONFIG_DIR = Path(os.environ.get("UTA_CONFIG_DIR", SERVER_DIR))
DATA_DIR = Path(os.environ.get("UTA_DATA_DIR", SERVER_DIR / "data"))
load_dotenv(CONFIG_DIR / ".env")
TOMOSHI_DB_PATH = DATA_DIR / "tomoshi-dict-open.db"
DESKTOP_MANAGEMENT_TOKEN = os.environ.get("UTA_DESKTOP_TOKEN", "")
