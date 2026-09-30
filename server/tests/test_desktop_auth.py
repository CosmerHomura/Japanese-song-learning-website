import sys
import unittest
from pathlib import Path

from fastapi import HTTPException
from starlette.requests import Request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from desktop_auth import require_paid_ai_access


def request_with_token(token=''):
    headers = [(b'x-uta-desktop-token', token.encode())] if token else []
    return Request({'type': 'http', 'headers': headers})


class DesktopAiAccessTests(unittest.TestCase):
    def test_desktop_session_requires_matching_token(self):
        with self.assertRaises(HTTPException) as error:
            require_paid_ai_access(request_with_token(), 'secret-placeholder')
        self.assertEqual(error.exception.status_code, 403)
        require_paid_ai_access(request_with_token('secret-placeholder'), 'secret-placeholder')

    def test_web_development_without_desktop_token_still_works(self):
        require_paid_ai_access(request_with_token(), '')
