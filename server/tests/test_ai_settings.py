"""Offline checks for provider settings and per-request cost accounting."""

import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server.services import ai_settings as service, model_catalog as catalog, ai_runtime as runtime


class AiSettingsTests(unittest.TestCase):
    def test_concurrent_key_saves_preserve_all_accounts(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ai-settings.json"
            with patch.object(service, "AI_SETTINGS_PATH", path), patch.object(service, "CONFIG_DIR", path.parent), \
                 patch.object(service, "protect", side_effect=lambda value: "protected:" + value), \
                 patch.object(service, "reveal", side_effect=lambda value: value.removeprefix("protected:")):
                def save_account(index):
                    return service.save_ai_settings(service.AiSettingsRequest(
                        provider="openai", base_url="https://api.openai.com/v1", model="test", api_key=f"fixture-key-{index}", key_name=f"账号 {index}"))
                with ThreadPoolExecutor(max_workers=6) as executor:
                    list(executor.map(save_account, range(12)))
                public = service.public_ai_settings()
                self.assertEqual(len(public["keys"]), 12)
                self.assertEqual(len({item["id"] for item in public["keys"]}), 12)
                self.assertNotIn("api_key", public)

    def test_provider_registry_uses_native_ids_and_excludes_retired_models(self):
        registry = {"deepseek": {"models": {
            "native-id": {"name": "Current", "modalities": {"output": ["text"]}},
            "retired": {"status": "deprecated", "modalities": {"output": ["text"]}},
            "image-only": {"modalities": {"output": ["image"]}},
        }}, "openrouter": {"models": {"deepseek/router-only": {"modalities": {"output": ["text"]}}}}}
        with patch.object(catalog, "cached_remote_json", return_value=registry):
            self.assertEqual(list(catalog.public_provider_catalog("deepseek")), ["native-id"])

    def test_registry_prices_are_already_per_million(self):
        settings = {"provider": "deepseek", "api_key": "", "base_url": "https://api.deepseek.com", "model": "native-id"}
        row = {"id": "native-id", "name": "Current", "cost": {"input": 1, "cache_read": 0.1, "output": 2}}
        with patch.object(catalog, "load_ai_settings", return_value=settings), patch.object(catalog, "litellm_price_catalog", return_value={}), patch.object(catalog, "public_provider_catalog", return_value={"native-id": row}), patch.object(catalog, "usd_to_cny_rate", return_value=(7, "test")):
            model = catalog.fetch_ai_models()[0]
        self.assertEqual(model["input_price"], 7)
        self.assertEqual(model["output_price"], 14)
        self.assertFalse(model["account_verified"])

    def test_api_key_is_saved_but_never_returned(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            settings_path = Path(temporary_directory) / "ai-settings.json"
            payload = service.AiSettingsRequest(
                provider="openrouter",
                base_url="https://openrouter.ai/api/v1",
                model="openai/example",
                api_key="secret-test-key",
                input_price=1.25,
                output_price=4.5,
                currency="usd",
                pricing_source="test catalog",
            )
            with patch.object(service, "AI_SETTINGS_PATH", settings_path), patch.object(service, "CONFIG_DIR", settings_path.parent):
                public = service.save_ai_settings(payload)
                private = service.load_ai_settings(include_key=True)
            self.assertNotIn("api_key", public)
            self.assertTrue(public["has_api_key"])
            self.assertEqual(private["api_key"], "secret-test-key")
            self.assertEqual(private["currency"], "CNY")
            self.assertEqual(private["pricing_source"], "test catalog")

    def test_provider_cost_wins_over_local_estimate(self):
        settings = {
            "provider": "openrouter", "model": "example", "currency": "CNY",
            "input_price": 10, "cached_input_price": 1, "output_price": 20,
        }
        with patch.object(runtime, "usd_to_cny_rate", return_value=(7.2, "test")):
            billing = runtime.billing_from_response({
                "model": "routed-model",
                "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150, "cost": 0.00123},
            }, settings)
        self.assertEqual(billing["estimated_cost"], round(0.00123 * 7.2, 8))
        self.assertFalse(billing["estimated"])
        self.assertEqual(billing["model"], "routed-model")

    def test_multiple_keys_can_be_selected_and_deleted_without_plaintext(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ai-settings.json"
            with patch.object(service, "AI_SETTINGS_PATH", path), patch.object(service, "CONFIG_DIR", path.parent):
                first = service.save_ai_settings(service.AiSettingsRequest(provider="openai", base_url="https://api.openai.com/v1", model="test", api_key="first-secret", key_name="个人"))
                first_id = first["selected_key_id"]
                second = service.save_ai_settings(service.AiSettingsRequest(provider="openai", base_url="https://api.openai.com/v1", model="test", api_key="second-secret", key_name="备用"))
                self.assertEqual(len(second["keys"]), 2)
                self.assertNotIn("first-secret", path.read_text(encoding="utf-8"))
                selected = service.save_ai_settings(service.AiSettingsRequest(provider="openai", base_url="https://api.openai.com/v1", model="test", selected_key_id=first_id))
                self.assertEqual(service.load_ai_settings(include_key=True)["api_key"], "first-secret")
                deleted = service.save_ai_settings(service.AiSettingsRequest(provider="openai", base_url="https://api.openai.com/v1", model="test", delete_key_id=first_id))
                self.assertFalse(deleted["has_api_key"])
                self.assertEqual(len(deleted["keys"]), 1)

    def test_native_provider_response_shapes_are_normalized(self):
        anthropic = runtime.normalize_provider_response({
            "model": "claude-test",
            "usage": {"input_tokens": 12, "output_tokens": 4, "cache_read_input_tokens": 3},
        }, "anthropic", "fallback")
        self.assertEqual(anthropic["usage"]["prompt_tokens"], 12)
        self.assertEqual(anthropic["usage"]["prompt_cache_hit_tokens"], 3)

        gemini = runtime.normalize_provider_response({
            "modelVersion": "gemini-test",
            "usageMetadata": {"promptTokenCount": 8, "candidatesTokenCount": 2, "totalTokenCount": 10},
        }, "gemini", "fallback")
        self.assertEqual(gemini["usage"]["completion_tokens"], 2)
        self.assertEqual(gemini["model"], "gemini-test")

    def test_json_text_is_read_from_anthropic_and_gemini(self):
        self.assertEqual(runtime.read_json_text({"content": [{"type": "text", "text": '{"ok": true}'}]}, "anthropic"), {"ok": True})
        self.assertEqual(runtime.read_json_text({"candidates": [{"content": {"parts": [{"text": '{"ok": true}'}]}}]}, "gemini"), {"ok": True})

    def test_models_can_be_listed_from_public_catalog_without_api_key(self):
        settings = {
            "provider": "openai", "base_url": "https://api.openai.com/v1", "model": "gpt-test",
            "api_key": "", "has_api_key": False, "input_price": 0, "cached_input_price": 0,
            "output_price": 0, "currency": "CNY", "pricing_source": "未获取",
        }
        prices = {"gpt-test": {
            "id": "gpt-test", "mode": "chat", "supported_endpoints": ["/v1/chat/completions"],
            "input_cost_per_token": 0.000001, "output_cost_per_token": 0.000002,
        }}
        with patch.object(catalog, "load_ai_settings", return_value=settings), \
             patch.object(catalog, "litellm_price_catalog", return_value=prices), \
             patch.object(catalog, "usd_to_cny_rate", return_value=(7.0, "test")), \
             patch.object(catalog, "cached_remote_json", return_value={"data": []}):
            models = catalog.fetch_ai_models()
        self.assertEqual(models[0]["id"], "gpt-test")
        self.assertEqual(models[0]["input_price"], 7.0)
        self.assertEqual(models[0]["model_source"], "公开动态模型目录")


if __name__ == "__main__":
    unittest.main()
