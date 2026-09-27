"""Offline checks for installing the optional Tomoshi database."""

import sqlite3
import sys
import tempfile
import time
import unittest
from pathlib import Path

import zstandard as zstd

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from server.dictionary_installer import DictionaryInstaller  # noqa: E402


class DictionaryInstallerTests(unittest.TestCase):
    def test_local_archive_is_decompressed_and_validated(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source_database = root / "source.db"
            archive = root / "tomoshi-dict-open.db.zst"
            target = root / "data" / "tomoshi-dict-open.db"
            connection = sqlite3.connect(source_database)
            try:
                connection.executescript(
                    "CREATE TABLE entries (id INTEGER);"
                    "CREATE TABLE forms (entry_id INTEGER);"
                    "CREATE TABLE zh_defs (entry_id INTEGER);"
                    "INSERT INTO entries VALUES (1);"
                )
                connection.commit()
            finally:
                connection.close()
            with source_database.open("rb") as source, archive.open("wb") as output:
                zstd.ZstdCompressor().copy_stream(source, output)

            installer = DictionaryInstaller(target.parent, target)
            installer.start_local_install(archive)
            deadline = time.monotonic() + 5
            while installer.status()["phase"] not in {"ready", "error"} and time.monotonic() < deadline:
                time.sleep(0.02)

            self.assertEqual(installer.status()["phase"], "ready")
            self.assertTrue(target.is_file())

    def test_local_install_rejects_an_unexpected_file(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "dictionary.zip"
            source.write_bytes(b"not a dictionary")
            installer = DictionaryInstaller(root / "data", root / "data" / "tomoshi-dict-open.db")
            with self.assertRaisesRegex(ValueError, "sqlite"):
                installer.start_local_install(source)

    def test_uncompressed_compatible_sqlite_is_copied_and_validated(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            source = root / "my-dictionary.sqlite"
            target = root / "data" / "tomoshi-dict-open.db"
            connection = sqlite3.connect(source)
            try:
                connection.executescript(
                    "CREATE TABLE entries (id INTEGER);"
                    "CREATE TABLE forms (entry_id INTEGER);"
                    "CREATE TABLE zh_defs (entry_id INTEGER);"
                )
                connection.commit()
            finally:
                connection.close()

            installer = DictionaryInstaller(target.parent, target)
            installer.start_local_install(source)
            deadline = time.monotonic() + 5
            while installer.status()["phase"] not in {"ready", "error"} and time.monotonic() < deadline:
                time.sleep(0.02)

            self.assertEqual(installer.status()["phase"], "ready")
            self.assertTrue(source.is_file())
            self.assertTrue(target.is_file())

    def test_cancel_stops_worker_and_keeps_resumable_archive(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            installer = DictionaryInstaller(root / "data", root / "data" / "tomoshi-dict-open.db")
            installer.data_dir.mkdir(parents=True)
            installer.download_path.write_bytes(b"partial download")

            def cancellable_action():
                while True:
                    installer._raise_if_cancelled()
                    time.sleep(0.01)

            installer._start_worker(cancellable_action)
            installer.cancel()
            deadline = time.monotonic() + 2
            while installer.status()["phase"] != "cancelled" and time.monotonic() < deadline:
                time.sleep(0.01)

            self.assertEqual(installer.status()["phase"], "cancelled")
            self.assertTrue(installer.download_path.is_file())


if __name__ == "__main__":
    unittest.main()
