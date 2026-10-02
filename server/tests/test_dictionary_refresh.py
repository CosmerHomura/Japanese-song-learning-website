import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from server.services import dictionary as service


def create_dictionary(path, meaning):
    connection = sqlite3.connect(path)
    connection.executescript('CREATE TABLE forms(text,entry_id,is_common); CREATE TABLE entries(id,is_common,data); CREATE TABLE zh_defs(entry_id,locale,data); CREATE TABLE freq_rank(entry_id,rank);')
    connection.execute('INSERT INTO forms VALUES(?,?,?)', ('猫', 1, 1))
    connection.execute('INSERT INTO entries VALUES(?,?,?)', (1, 1, json.dumps({'kana': [{'text': 'ねこ'}]})))
    connection.execute('INSERT INTO zh_defs VALUES(?,?,?)', (1, 'zh-CN', json.dumps({'senses': {'1': {'glosses': [{'text': meaning}]}}})))
    connection.commit()
    connection.close()


class DictionaryRefreshTests(unittest.TestCase):
    def test_install_and_replace_take_effect_without_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'dictionary.db'
            with patch.object(service, 'TOMOSHI_DB_PATH', path):
                self.assertIsNone(service.lookup_tomoshi_word(('猫',), 'ねこ', '名詞'))
                create_dictionary(path, '猫')
                self.assertEqual(service.lookup_tomoshi_word(('猫',), 'ねこ', '名詞')['meaning'], '猫')
                replacement = path.with_name('replacement.db')
                create_dictionary(replacement, '猫科动物')
                with service.DICTIONARY_LOCK:
                    os.replace(replacement, path)
                self.assertEqual(service.lookup_tomoshi_word(('猫',), 'ねこ', '名詞')['meaning'], '猫科动物')
