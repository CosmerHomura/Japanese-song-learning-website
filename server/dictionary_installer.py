"""Download, resume, validate, and install the optional Tomoshi database."""

from __future__ import annotations

import os
import sqlite3
import threading
from pathlib import Path
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

import zstandard as zstd


TOMOSHI_RELEASES_URL = "https://github.com/tomoshi-app/tomoshi-dict-data/releases"
TOMOSHI_LATEST_DOWNLOAD_URL = (
    "https://github.com/tomoshi-app/tomoshi-dict-data/"
    "releases/latest/download/tomoshi-dict-open.db.zst"
)
SUPPORTED_DICTIONARY_EXTENSIONS = {".zst", ".db", ".sqlite", ".sqlite3"}


class DictionaryInstallCancelled(Exception):
    """Internal control flow for a user-requested cancellation."""


class DictionaryInstaller:
    def __init__(self, data_dir: Path, target_path: Path) -> None:
        self.data_dir = data_dir
        self.target_path = target_path
        self.download_path = data_dir / "tomoshi-dict-open.db.partial.zst"
        self.database_partial_path = data_dir / "tomoshi-dict-open.db.partial"
        self._lock = threading.Lock()
        self._cancel_event = threading.Event()
        self._state: dict[str, Any] = {
            "phase": "ready" if target_path.is_file() else "idle",
            "downloaded_bytes": 0,
            "total_bytes": None,
            "error": "",
        }

    def status(self) -> dict[str, Any]:
        with self._lock:
            state = dict(self._state)
        state.update({
            "installed": self.target_path.is_file(),
            "releases_url": TOMOSHI_RELEASES_URL,
            "download_url": TOMOSHI_LATEST_DOWNLOAD_URL,
            "supported_formats": [".db.zst", ".db", ".sqlite", ".sqlite3"],
        })
        if state["installed"]:
            state["phase"] = "ready"
        return state

    def start_download(self) -> dict[str, Any]:
        self._start_worker(self._download_and_install)
        return self.status()

    def start_local_install(self, source_path: Path) -> dict[str, Any]:
        source_path = source_path.resolve()
        if not source_path.is_file() or source_path.suffix.lower() not in SUPPORTED_DICTIONARY_EXTENSIONS:
            raise ValueError("请选择 .db.zst、.db、.sqlite 或 .sqlite3 格式的兼容词典。")
        if source_path.suffix.lower() == ".zst":
            action = lambda: self._install_archive(source_path, delete_source=False)
        else:
            action = lambda: self._install_database(source_path)
        self._start_worker(action)
        return self.status()

    def cancel(self) -> dict[str, Any]:
        with self._lock:
            if self._state["phase"] not in {"downloading", "installing", "cancelling"}:
                pass
            else:
                self._state.update({"phase": "cancelling", "error": ""})
                self._cancel_event.set()
        return self.status()

    def _start_worker(self, action: Any) -> None:
        with self._lock:
            if self._state["phase"] in {"downloading", "installing", "cancelling"}:
                raise RuntimeError("词典下载或安装已在进行中。")
            self._cancel_event.clear()
            self._state.update({
                "phase": "downloading" if action == self._download_and_install else "installing",
                "downloaded_bytes": 0,
                "total_bytes": None,
                "error": "",
            })
        threading.Thread(target=self._run_worker, args=(action,), daemon=True).start()

    def _run_worker(self, action: Any) -> None:
        try:
            action()
        except DictionaryInstallCancelled:
            try:
                self.database_partial_path.unlink(missing_ok=True)
            except OSError:
                pass
            with self._lock:
                self._state.update({"phase": "cancelled", "error": ""})
        except Exception as error:  # The status endpoint reports background failures.
            try:
                self.database_partial_path.unlink(missing_ok=True)
            except OSError:
                pass
            with self._lock:
                self._state.update({"phase": "error", "error": str(error)[:500]})

    def _download_and_install(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        existing_size = self.download_path.stat().st_size if self.download_path.is_file() else 0
        if existing_size:
            try:
                self._install_archive(self.download_path, delete_source=True)
                return
            except Exception:
                self.database_partial_path.unlink(missing_ok=True)
                with self._lock:
                    self._state.update({"phase": "downloading", "error": ""})
        headers = {"User-Agent": "UTA-Japanese-song-learning"}
        if existing_size:
            headers["Range"] = f"bytes={existing_size}-"
        request = urllib_request.Request(TOMOSHI_LATEST_DOWNLOAD_URL, headers=headers)
        try:
            with urllib_request.urlopen(request, timeout=30) as response:
                resumed = existing_size > 0 and getattr(response, "status", 200) == 206
                downloaded = existing_size if resumed else 0
                content_length = response.headers.get("Content-Length")
                total = downloaded + int(content_length) if content_length else None
                mode = "ab" if resumed else "wb"
                with self.download_path.open(mode) as output:
                    while chunk := response.read(1024 * 1024):
                        self._raise_if_cancelled()
                        output.write(chunk)
                        downloaded += len(chunk)
                        with self._lock:
                            self._state.update({
                                "phase": "downloading",
                                "downloaded_bytes": downloaded,
                                "total_bytes": total,
                            })
        except urllib_error.HTTPError as error:
            if error.code == 416 and existing_size:
                self.download_path.unlink(missing_ok=True)
                return self._download_and_install()
            raise
        self._install_archive(self.download_path, delete_source=True)

    def _install_archive(self, source_path: Path, *, delete_source: bool) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        with self._lock:
            self._state.update({"phase": "installing", "error": ""})
        self.database_partial_path.unlink(missing_ok=True)
        with source_path.open("rb") as compressed, self.database_partial_path.open("wb") as output:
            with zstd.ZstdDecompressor().stream_reader(compressed) as reader:
                while chunk := reader.read(1024 * 1024):
                    self._raise_if_cancelled()
                    output.write(chunk)
        self._raise_if_cancelled()
        self._validate_database(self.database_partial_path)
        self._raise_if_cancelled()
        os.replace(self.database_partial_path, self.target_path)
        if delete_source:
            source_path.unlink(missing_ok=True)
        with self._lock:
            self._state.update({"phase": "ready", "error": ""})

    def _install_database(self, source_path: Path) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        with self._lock:
            self._state.update({"phase": "installing", "error": "", "total_bytes": source_path.stat().st_size})
        self.database_partial_path.unlink(missing_ok=True)
        copied = 0
        with source_path.open("rb") as source, self.database_partial_path.open("wb") as output:
            while chunk := source.read(1024 * 1024):
                self._raise_if_cancelled()
                output.write(chunk)
                copied += len(chunk)
                with self._lock:
                    self._state["downloaded_bytes"] = copied
        self._raise_if_cancelled()
        self._validate_database(self.database_partial_path)
        self._raise_if_cancelled()
        os.replace(self.database_partial_path, self.target_path)
        with self._lock:
            self._state.update({"phase": "ready", "error": ""})

    def _raise_if_cancelled(self) -> None:
        if self._cancel_event.is_set():
            raise DictionaryInstallCancelled()

    @staticmethod
    def _validate_database(path: Path) -> None:
        database_uri = f"{path.resolve().as_uri()}?mode=ro"
        connection = sqlite3.connect(database_uri, uri=True)
        try:
            tables = {
                row[0]
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                )
            }
            required_tables = {"entries", "forms", "zh_defs"}
            if not required_tables.issubset(tables):
                raise ValueError("词典格式不兼容：SQLite 数据库必须包含 entries、forms、zh_defs 三张表。")
            connection.execute("SELECT 1 FROM entries LIMIT 1").fetchone()
        finally:
            connection.close()
