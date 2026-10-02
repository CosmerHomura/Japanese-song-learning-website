import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.services import annotation as service

class MonthReadingTests(unittest.TestCase):
    @patch.object(service, 'lookup_tomoshi_word', return_value=None)
    def test_calendar_month_is_one_token_with_irregular_reading(self, lookup):
        for text, expected in [('4月に会う', 'しがつ'), ('7月に会う', 'しちがつ'), ('9月に会う', 'くがつ')]:
            tokens = service.annotate_text(text)
            self.assertTrue(tokens[0].surface.endswith('月'))
            self.assertEqual(tokens[0].reading, expected)

    @patch.object(service, 'lookup_tomoshi_word', return_value=None)
    def test_duration_counter_is_not_a_calendar_month(self, lookup):
        tokens = service.annotate_text('4か月待つ')
        self.assertFalse(any(token.surface == '4月' for token in tokens))
