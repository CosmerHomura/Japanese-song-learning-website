import unittest
from unittest.mock import patch
from fastapi import HTTPException
from starlette.requests import Request
from server.routes import ai
from server.schemas import SongReviewRequest


class ReviewTokenTests(unittest.TestCase):
    def test_review_uses_users_current_word_boundaries_and_reading(self):
        payload = SongReviewRequest(song_id='s', title='原创示例', lines=[{'id': 0, 'text': '四月に会う', 'tokens': [
            {'index': 0, 'surface': '四月', 'reading': 'しがつ'},
            {'index': 1, 'surface': 'に会う', 'reading': 'にあう'},
        ]}])
        response = {'suggestions': [{'line_id': 0, 'token_index': 1, 'suggested_reading': 'にあおう', 'confidence': .8}]}
        incoming = Request({'type': 'http', 'headers': []})
        with patch.object(ai, 'require_paid_ai_access'), patch.object(ai, 'call_deepseek_json', return_value=response) as call:
            result = ai.review_song_with_ai(payload, incoming)
        self.assertEqual(call.call_args.args[2]['lines'][0]['tokens'][0]['reading'], 'しがつ')
        self.assertEqual(result['suggestions'][0]['surface'], 'に会う')

    def test_mismatched_word_boundaries_are_rejected_before_paid_request(self):
        payload = SongReviewRequest(song_id='s', title='原创示例', lines=[{'id': 0, 'text': '四月', 'tokens': [{'index': 0, 'surface': '五月'}]}])
        with patch.object(ai, 'require_paid_ai_access'), patch.object(ai, 'call_deepseek_json') as call:
            with self.assertRaises(HTTPException) as error:
                ai.review_song_with_ai(payload, Request({'type': 'http', 'headers': []}))
        self.assertEqual(error.exception.status_code, 422)
        call.assert_not_called()
