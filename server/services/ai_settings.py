"""Encrypted local credentials and provider configuration."""
import json
import os
import threading
import uuid
from typing import Any
from fastapi import HTTPException
from server.config import CONFIG_DIR
from server.schemas import AiSettingsRequest
from server.ai_providers import AI_PROVIDERS, AI_PROVIDER_DEFAULTS
from server.key_vault import protect, reveal
from server.http_security import validate_api_url
from server.services.ai_cache import AI_CACHE, AI_CACHE_LOCK

AI_SETTINGS_PATH = CONFIG_DIR / "ai-settings.json"
AI_SETTINGS_LOCK = threading.RLock()
def read_settings_document() -> dict[str, Any]:
    try:
        raw = json.loads(AI_SETTINGS_PATH.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except (OSError, ValueError):
        return {}


def write_settings_document(document: dict[str, Any]) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    temporary = AI_SETTINGS_PATH.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, AI_SETTINGS_PATH)


def saved_key(document: dict[str, Any], provider: str, key_id: str) -> str:
    record = next((item for item in document.get("keys", []) if item.get("provider") == provider and item.get("id") == key_id), None)
    return reveal(record["encrypted"]) if record else ""


def load_ai_settings(*, include_key: bool = False) -> dict[str, Any]:
    with AI_SETTINGS_LOCK:
        return _load_ai_settings(include_key=include_key)


def _load_ai_settings(*, include_key: bool = False) -> dict[str, Any]:
    stored = read_settings_document()
    # Migrate the previous plaintext setting into a Windows-protected record.
    if stored.get("api_key"):
        with AI_SETTINGS_LOCK:
            key = str(stored.pop("api_key"))
            key_id = uuid.uuid4().hex
            stored.setdefault("keys", []).append({"id": key_id, "provider": stored.get("provider", "deepseek"), "name": "默认账号", "last_four": key[-4:], "encrypted": protect(key)})
            stored["selected_key_id"] = key_id
            write_settings_document(stored)
    provider = stored.get("provider") if stored.get("provider") in AI_PROVIDERS else "deepseek"
    defaults = AI_PROVIDERS[provider]
    configured_base_url = stored.get("base_url") if provider == "custom" else defaults["base_url"]
    settings = {
        "provider": provider,
        "base_url": validate_api_url(str(configured_base_url or defaults["base_url"])),
        "model": str(stored.get("model") or os.getenv("DEEPSEEK_MODEL") or defaults["model"]),
        "input_price": max(0.0, float(stored.get("input_price") or 0)),
        "cached_input_price": max(0.0, float(stored.get("cached_input_price") or 0)),
        "output_price": max(0.0, float(stored.get("output_price") or 0)),
        "currency": "CNY",
        "pricing_source": str(stored.get("pricing_source") or "未获取"),
        "selected_key_id": str(stored.get("selected_key_id") or ""),
    }
    api_key = saved_key(stored, provider, settings["selected_key_id"])
    if not stored.get("keys") and "selected_key_id" not in stored and provider == "deepseek":
        api_key = str(os.getenv("DEEPSEEK_API_KEY") or "").strip()
    settings["has_api_key"] = bool(api_key)
    if include_key:
        settings["api_key"] = api_key
    return settings


def public_ai_settings() -> dict[str, Any]:
    with AI_SETTINGS_LOCK:
        return _public_ai_settings()


def _public_ai_settings() -> dict[str, Any]:
    settings = load_ai_settings()
    settings["provider_defaults"] = AI_PROVIDER_DEFAULTS
    settings["keys"] = [{key: item.get(key, "") for key in ("id", "provider", "name", "last_four")} for item in read_settings_document().get("keys", [])]
    settings["providers"] = [
        {"id": key, "label": value["label"], "custom_endpoint": key == "custom"}
        for key, value in AI_PROVIDERS.items()
    ]
    return settings


def save_ai_settings(payload: AiSettingsRequest) -> dict[str, Any]:
    with AI_SETTINGS_LOCK:
        return _save_ai_settings(payload)


def _save_ai_settings(payload: AiSettingsRequest) -> dict[str, Any]:
    if payload.provider not in AI_PROVIDERS:
        raise HTTPException(status_code=422, detail="不支持的 AI 供应商。")
    provider = AI_PROVIDERS[payload.provider]
    base_url = (payload.base_url if payload.provider == "custom" else provider["base_url"]).strip().rstrip("/")
    base_url = validate_api_url(base_url)
    try:
        load_ai_settings()  # Migrate any legacy secret before modifying metadata.
    except HTTPException as error:
        # Permit replacing an old invalid endpoint with the validated new one.
        if error.status_code != 422:
            raise
    previous = read_settings_document()
    stored = payload.model_dump()
    stored.pop("api_key", None)
    stored.pop("delete_key_id", None)
    stored.pop("key_name", None)
    records = previous.get("keys", [])
    if payload.delete_key_id:
        records = [item for item in records if not (item.get("id") == payload.delete_key_id and item.get("provider") == payload.provider)]
    if payload.api_key.strip():
        secret = payload.api_key.strip()
        key_id = uuid.uuid4().hex
        records.append({"id": key_id, "provider": payload.provider, "name": payload.key_name.strip() or f"Key {len([record for record in records if record.get('provider') == payload.provider]) + 1}", "last_four": secret[-4:], "encrypted": protect(secret)})
        stored["selected_key_id"] = key_id
    stored["keys"] = records
    if not any(item["id"] == stored["selected_key_id"] and item["provider"] == payload.provider for item in records):
        stored["selected_key_id"] = ""
    stored["base_url"] = base_url
    stored["model"] = payload.model.strip()
    stored["currency"] = "CNY"
    with AI_SETTINGS_LOCK:
        write_settings_document(stored)
    with AI_CACHE_LOCK:
        AI_CACHE.clear()
    return public_ai_settings()
