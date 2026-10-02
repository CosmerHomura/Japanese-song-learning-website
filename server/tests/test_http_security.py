import threading
import tempfile
import json
from pathlib import Path
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.request import Request
from urllib.error import HTTPError
from unittest.mock import patch
from fastapi import HTTPException
from server.http_security import validate_api_url, open_credential_request
from server.services import ai_settings, model_catalog, ai_runtime
from server.schemas import AiSettingsRequest


class HttpSecurityTests(unittest.TestCase):
    def test_endpoint_parses_host_instead_of_prefix(self):
        for url in ['https://api.example.invalid/v1', 'http://localhost:11434/v1', 'http://127.0.0.1:1234/v1', 'http://[::1]:1234/v1']:
            self.assertEqual(validate_api_url(url), url)
        for url in ['http://localhost.example.invalid/v1', 'http://127.0.0.1.example.invalid', 'http://localhost@example.invalid', 'https://user:pass@example.invalid', 'https://example.invalid?key=x', 'https://example.invalid#x', 'file:///tmp/key', 'http://192.168.0.1', 'https://example.invalid:bad', 'https://example.invalid:0', 'https://example.invalid\\path', 'https://example.invalid/ bad']:
            with self.subTest(url=url), self.assertRaises(HTTPException):
                validate_api_url(url)

    def test_invalid_settings_rejected_before_saving_key(self):
        with patch.object(ai_settings, 'write_settings_document') as write, patch.object(ai_settings, 'protect') as encrypt:
            with self.assertRaises(HTTPException):
                ai_settings.save_ai_settings(AiSettingsRequest(provider='custom', base_url='http://localhost.example.invalid', model='test', api_key='dummy'))
            write.assert_not_called()
            encrypt.assert_not_called()

    def test_model_refresh_rejects_invalid_override_before_network(self):
        with patch.object(model_catalog, 'load_ai_settings', return_value={}), patch.object(model_catalog, 'read_settings_document', return_value={}), patch.object(model_catalog, 'litellm_price_catalog') as remote:
            with self.assertRaises(HTTPException):
                model_catalog.fetch_ai_models(AiSettingsRequest(provider='custom', base_url='http://localhost.example.invalid', model='test', api_key='dummy'))
            remote.assert_not_called()

    def test_credential_request_blocks_all_redirect_codes(self):
        received = []
        class Sink(BaseHTTPRequestHandler):
            def do_GET(self):
                received.append(self.headers.get('Authorization'))
                self.send_response(200); self.end_headers()
            do_POST = do_GET
            def log_message(self, *args): pass
        sink = HTTPServer(('127.0.0.1', 0), Sink)
        class Redirect(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(int(self.path[1:])); self.send_header('Location', f'http://127.0.0.1:{sink.server_port}/sink'); self.end_headers()
            do_POST = do_GET
            def log_message(self, *args): pass
        source = HTTPServer(('127.0.0.1', 0), Redirect)
        for server in (sink, source): threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            for code in (301, 302, 303, 307, 308):
                for data in (None, b'{}'):
                    with self.subTest(code=code, post=data is not None), self.assertRaises(HTTPError):
                        open_credential_request(Request(f'http://127.0.0.1:{source.server_port}/{code}', data=data, headers={'Authorization': 'Bearer dummy-audit-key'}), timeout=3)
            self.assertEqual(received, [])
        finally:
            for server in (source, sink): server.shutdown(); server.server_close()

    def test_desktop_call_sites_use_credential_boundary(self):
        # Both modules must use the same redirect-blocking boundary.
        self.assertIs(model_catalog.open_credential_request, open_credential_request)
        self.assertIs(ai_runtime.open_credential_request, open_credential_request)

    def test_legacy_invalid_endpoint_can_be_replaced_without_losing_keys(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / 'ai-settings.json'
            target.write_text(json.dumps({'provider': 'custom', 'base_url': 'http://localhost.example.invalid', 'keys': [{'id': 'existing', 'provider': 'custom', 'encrypted': 'fixture', 'name': 'fixture', 'last_four': 'test'}], 'selected_key_id': 'existing'}))
            with patch.object(ai_settings, 'AI_SETTINGS_PATH', target), patch.object(ai_settings, 'CONFIG_DIR', target.parent), patch.object(ai_settings, 'reveal', return_value='dummy'):
                result = ai_settings.save_ai_settings(AiSettingsRequest(provider='custom', base_url='https://api.example.invalid/v1', model='test', selected_key_id='existing'))
            self.assertEqual(result['base_url'], 'https://api.example.invalid/v1')
            self.assertTrue(result['has_api_key'])
            self.assertEqual(len(result['keys']), 1)
