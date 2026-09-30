"""Provider boundaries: credentials, compatible requests, and useful failures."""
import json
import sys
import unittest
from io import BytesIO
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.parse import quote

from fastapi import HTTPException
from starlette.requests import Request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import ai_provider as providers
import app as service


def config(**changes):
    return dict(name='Example', protocol='openai-compatible', base_url='https://example.com/v1',
                model='test-model', api_key='test-private-key', json_mode=True) | changes


class ProviderTests(unittest.TestCase):
    def test_address_validation(self):
        for url in ['http://localhost:11434/v1', 'http://192.168.1.2:8080/v1', 'http://[::1]:1234/v1',
                    'https://example.com/v1', 'https://example.com/v1/chat/completions/']:
            self.assertTrue(providers.validate_provider(config(base_url=url)).endpoint.endswith('/chat/completions'))
        for url in ['file:///tmp/key', 'http://example.com', 'https://user:pass@example.com',
                    'https://example.com?key=secret', 'http://169.254.169.254', 'https://example.com:bad']:
            with self.assertRaises(HTTPException):
                providers.validate_provider(config(base_url=url))

    def test_explicit_empty_key_does_not_use_server_key(self):
        data = quote(json.dumps(config(api_key=''))).encode()
        incoming = Request({'type': 'http', 'headers': [(b'x-uta-ai-config', data)]})
        with patch.dict('os.environ', {'DEEPSEEK_API_KEY': 'server-only-secret'}):
            self.assertEqual(providers.provider_from_request(incoming).api_key, '')

    def test_request_shape_and_key_destination(self):
        provider = providers.validate_provider(config())
        response = BytesIO(json.dumps({'choices': [{'message': {'content': '{"ok":true}'}}]}).encode())
        with patch.object(providers.request, 'build_opener') as opener:
            opener.return_value.open.return_value = response
            self.assertEqual(providers.request_json(provider, 'Return JSON', {}, 100), {'ok': True})
            outgoing = opener.return_value.open.call_args.args[0]
            body = json.loads(outgoing.data)
            self.assertEqual(outgoing.full_url, 'https://example.com/v1/chat/completions')
            self.assertEqual(outgoing.get_header('Authorization'), 'Bearer test-private-key')
            self.assertNotIn('thinking', body)
            self.assertNotIn('temperature', body)
            self.assertEqual(body['max_tokens'], 100)

    def test_official_openai_token_limit_and_optional_json_mode(self):
        provider = providers.validate_provider(config(base_url='https://api.openai.com/v1', json_mode=False, api_key=''))
        response = BytesIO(json.dumps({'choices': [{'message': {'content': '```json\n{"ok":true}\n```'}}]}).encode())
        with patch.object(providers.request, 'build_opener') as opener:
            opener.return_value.open.return_value = response
            providers.request_json(provider, 'Return JSON', {}, 100)
            outgoing = opener.return_value.open.call_args.args[0]
            body = json.loads(outgoing.data)
            self.assertIn('max_completion_tokens', body)
            self.assertNotIn('response_format', body)
            self.assertIsNone(outgoing.get_header('Authorization'))

    def test_deepseek_extensions(self):
        provider = providers.validate_provider(config(protocol='deepseek'))
        response = BytesIO(b'{"choices":[{"message":{"content":"{\\"ok\\":true}"}}]}')
        with patch.object(providers.request, 'build_opener') as opener:
            opener.return_value.open.return_value = response
            providers.request_json(provider, 'Return JSON', {}, 100)
            self.assertEqual(json.loads(opener.return_value.open.call_args.args[0].data)['thinking'], {'type': 'disabled'})

    def test_failure_never_echoes_provider_body_or_key(self):
        provider = providers.validate_provider(config())
        self.assertNotIn('test-private-key', repr(provider))
        with patch.object(providers.request, 'build_opener') as opener:
            opener.return_value.open.side_effect = HTTPError(provider.endpoint, 401, 'test-private-key', {}, BytesIO(b'test-private-key'))
            with self.assertRaises(HTTPException) as raised:
                providers.request_json(provider, 'Return JSON', {}, 100)
            self.assertNotIn('test-private-key', str(raised.exception))
            self.assertIn('API Key', raised.exception.detail)

    def test_cache_is_scoped_to_provider_model_and_credential(self):
        first = providers.validate_provider(config())
        key = service.ai_cache_key('explain', {'text': 'test'}, first)
        for changes in [{'api_key': 'different'}, {'model': 'different'}, {'base_url': 'https://other.example/v1'}, {'json_mode': False}]:
            self.assertNotEqual(key, service.ai_cache_key('explain', {'text': 'test'}, providers.validate_provider(config(**changes))))

    def test_browser_selected_provider_does_not_read_desktop_key(self):
        selected = providers.validate_provider(config())
        with patch.object(service, 'load_ai_settings', side_effect=AssertionError('desktop key accessed')):
            with patch.object(service, 'request_json', return_value={'ok': True}) as outgoing:
                result = service.call_deepseek_json('test', 'Return JSON', {}, client_host='browser-test', max_tokens=100, config=selected, use_cache=False)
        self.assertEqual(result, {'ok': True})
        self.assertIs(outgoing.call_args.args[0], selected)

    def test_status_never_returns_key(self):
        with patch.dict('os.environ', {'DEEPSEEK_API_KEY': 'server-only-secret'}):
            result = service.ai_status()
            self.assertTrue(result['configured'])
            self.assertNotIn('server-only-secret', json.dumps(result))

    def test_redirects_are_not_followed(self):
        self.assertIsNone(providers.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.example'))


if __name__ == '__main__':
    unittest.main()
