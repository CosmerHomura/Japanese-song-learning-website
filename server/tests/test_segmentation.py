import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app as service


class SegmentationTests(unittest.TestCase):
    @patch.object(service, 'lookup_tomoshi_word', return_value=None)
    def test_merge_and_split_keep_explicit_boundaries(self, lookup):
        for parts in [['4月'], ['4', '月']]:
            result = service.parse_explicit_segments('4月', parts)
            self.assertEqual([token['surface'] for token in result], parts)
        self.assertEqual(service.parse_explicit_segments('4月', ['4月'])[0]['reading'], 'しがつ')

    def test_reject_changed_lyrics_and_empty_segments(self):
        for parts in [['四月'], ['4月', ''], ['4', 1], []]:
            with self.assertRaises(HTTPException):
                service.parse_explicit_segments('4月', parts)

    @patch.object(service, 'lookup_tomoshi_word', return_value=None)
    def test_spaces_are_preserved_and_unknown_merge_has_no_fake_meaning(self, lookup):
        result = service.parse_explicit_segments('猫 と犬', ['猫', ' ', 'と犬'])
        self.assertEqual(''.join(token['surface'] for token in result), '猫 と犬')
        self.assertIsNone(result[-1]['meaning'])
        self.assertIn('未命中', result[-1]['dictionary_source'])

    @patch.object(service, 'lookup_tomoshi_word', return_value=None)
    @patch.object(service, 'call_deepseek_json', return_value={'segments': ['四月'], '_billing': {'total_cny': 0.1}})
    def test_ai_changed_text_is_rejected_but_billing_retained(self, call, lookup):
        from starlette.requests import Request
        result = service.resegment_with_ai(service.SegmentationRequest(text='4月', line_text='4月に会う'), Request({'type': 'http', 'client': ('127.0.0.1', 1)}))
        self.assertEqual(result['tokens'], [])
        self.assertEqual(result['billing']['total_cny'], 0.1)
