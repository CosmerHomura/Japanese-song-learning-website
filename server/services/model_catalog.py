"""Provider model discovery, offline catalog cache and CNY pricing."""
import hashlib
import json
import threading
import time
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from typing import Any
from urllib import error as urllib_error, parse as urllib_parse, request as urllib_request
from fastapi import HTTPException
from server.config import CONFIG_DIR
from server.schemas import AiSettingsRequest
from server.ai_providers import AI_PROVIDERS
from server.services.ai_settings import load_ai_settings, saved_key, read_settings_document
from server.services.ai_cache import AI_CACHE_TTL_SECONDS

AI_METADATA_CACHE: dict[str, tuple[float, Any]] = {}
AI_METADATA_DATES: dict[str, str] = {}
AI_CACHE_LOCK = threading.Lock()
def ai_endpoint(base_url: str, suffix: str) -> str:
    return f"{base_url.rstrip('/')}/{suffix.lstrip('/')}"


def cached_remote_json(cache_key: str, url: str, *, headers: dict[str, str] | None = None) -> Any:
    now = time.monotonic()
    with AI_CACHE_LOCK:
        cached = AI_METADATA_CACHE.get(cache_key)
        if cached and now - cached[0] < AI_CACHE_TTL_SECONDS:
            return cached[1]
    disk_path = CONFIG_DIR / "model-catalog-cache" / (hashlib.sha256(cache_key.encode()).hexdigest() + ".json")
    request = urllib_request.Request(url, headers=headers or {})
    try:
        with urllib_request.urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode("utf-8"))
        disk_path.parent.mkdir(parents=True, exist_ok=True)
        updated_at = datetime.now(timezone.utc).isoformat()
        AI_METADATA_DATES[cache_key] = updated_at
        disk_path.write_text(json.dumps({"updated_at": updated_at, "data": payload}), encoding="utf-8")
    except (urllib_error.URLError, TimeoutError, ValueError):
        if not disk_path.is_file():
            raise
        saved = json.loads(disk_path.read_text(encoding="utf-8"))
        payload = saved["data"]
        AI_METADATA_DATES[cache_key] = saved.get("updated_at", "")
    with AI_CACHE_LOCK:
        AI_METADATA_CACHE[cache_key] = (now, payload)
    return payload


def usd_to_cny_rate() -> tuple[float, str]:
    cache_key = "ecb-usd-cny"
    now = time.monotonic()
    with AI_CACHE_LOCK:
        cached = AI_METADATA_CACHE.get(cache_key)
        if cached and now - cached[0] < AI_CACHE_TTL_SECONDS:
            return cached[1]
    try:
        request = urllib_request.Request(
            "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml",
            headers={"User-Agent": "UTA-Japanese-Song-Learning/0.1"},
        )
        with urllib_request.urlopen(request, timeout=12) as response:
            root = ET.fromstring(response.read())
        rates = {node.attrib["currency"]: float(node.attrib["rate"]) for node in root.iter() if "currency" in node.attrib}
        value = (rates["CNY"] / rates["USD"], "欧洲央行每日参考汇率")
    except (urllib_error.URLError, TimeoutError, ET.ParseError, KeyError, ValueError, ZeroDivisionError):
        value = (7.2, "离线备用汇率")
    with AI_CACHE_LOCK:
        AI_METADATA_CACHE[cache_key] = (now, value)
    return value


def litellm_price_catalog(provider: str) -> dict[str, dict[str, Any]]:
    if not provider:
        return {}
    try:
        url = "https://api.litellm.ai/model_catalog?" + urllib_parse.urlencode({"provider": provider, "page_size": 500})
        payload = cached_remote_json(f"litellm:{provider}", url, headers={"User-Agent": "UTA-Japanese-Song-Learning/0.1"})
    except (urllib_error.URLError, urllib_error.HTTPError, TimeoutError, json.JSONDecodeError):
        return {}
    rows = payload.get("data", payload.get("models", [])) if isinstance(payload, dict) else payload
    catalog: dict[str, dict[str, Any]] = {}
    for item in rows if isinstance(rows, list) else []:
        if not isinstance(item, dict):
            continue
        model_id = str(item.get("id") or item.get("model") or item.get("model_name") or "")
        if model_id:
            catalog[model_id] = item
    return catalog


def catalog_entry(catalog: dict[str, dict[str, Any]], model_id: str) -> dict[str, Any]:
    candidates = [model_id, *(key for key in catalog if key.endswith(f"/{model_id}"))]
    return next((catalog[key] for key in candidates if key in catalog), {})


def public_provider_catalog(provider_id: str) -> dict[str, dict[str, Any]]:
    # Match the actual hosting provider, not the model's author on a router.
    registry_ids = {"google": "google", "alibaba": "alibaba", "siliconflow": "siliconflow-cn", "together": "togetherai", "moonshot": "moonshotai-cn", "zhipu": "zhipuai", "minimax": "minimax-cn", "nvidia": "nvidia"}
    if provider_id == "custom":
        return {}
    try:
        registry = cached_remote_json("models-dev-providers-v1", "https://models.dev/api.json", headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
        models = registry.get(registry_ids.get(provider_id, provider_id), {}).get("models", {})
        return {model_id: row for model_id, row in models.items() if isinstance(row, dict) and row.get("status") != "deprecated" and "text" in row.get("modalities", {}).get("output", [])}
    except (urllib_error.URLError, TimeoutError, ValueError, AttributeError):
        return {}


def catalog_price(catalog: dict[str, dict[str, Any]], model_id: str) -> tuple[float | None, float | None, float | None]:
    item = catalog_entry(catalog, model_id)
    def per_million(*fields: str) -> float | None:
        for field in fields:
            try:
                return float(item[field]) * 1_000_000
            except (KeyError, TypeError, ValueError):
                continue
        return None
    return (
        per_million("input_cost_per_token", "input_cost"),
        per_million("cache_read_input_token_cost", "cache_read_cost_per_token"),
        per_million("output_cost_per_token", "output_cost"),
    )


def fetch_ai_models(overrides: AiSettingsRequest | None = None) -> list[dict[str, Any]]:
    settings = load_ai_settings(include_key=True)
    if overrides is not None:
        provider_override = AI_PROVIDERS.get(overrides.provider)
        chosen_key = saved_key(read_settings_document(), overrides.provider, overrides.selected_key_id)
        settings.update({
            "provider": overrides.provider,
            "base_url": (overrides.base_url if overrides.provider == "custom" or not provider_override else provider_override["base_url"]).strip().rstrip("/"),
            "model": overrides.model.strip(),
            "api_key": overrides.api_key.strip() or chosen_key,
        })
    if settings["provider"] not in AI_PROVIDERS:
        raise HTTPException(status_code=422, detail="不支持的 AI 供应商。")
    provider = AI_PROVIDERS[settings["provider"]]
    catalog = litellm_price_catalog(provider.get("pricing_provider", ""))
    provider_catalog = public_provider_catalog(settings["provider"])
    cny_rate, exchange_source = usd_to_cny_rate()
    # Most vendor model endpoints require authentication.  The public,
    # continuously updated catalog lets users browse models and prices before
    # entering a key; once a key exists, the vendor endpoint becomes the
    # authoritative list for that account.
    raw_models: list[dict[str, Any]] = []
    model_source = "公开动态模型目录"
    from_provider = False
    public_rows = [{**row, "id": model_id} for model_id, row in provider_catalog.items()]
    if public_rows:
        model_source = "Models.dev 供应商注册表（社区维护）"
    can_query_provider = bool(settings["api_key"]) or settings["provider"] in {"openrouter", "custom"}
    if can_query_provider:
        headers = {"Accept": "application/json", "User-Agent": "UTA-Japanese-Song-Learning/0.1"}
        if provider["protocol"] == "anthropic":
            headers.update({"x-api-key": settings["api_key"], "anthropic-version": "2023-06-01"})
        elif provider["protocol"] == "gemini":
            headers["x-goog-api-key"] = settings["api_key"]
        elif settings["api_key"]:
            headers["Authorization"] = f"Bearer {settings['api_key']}"
        models_url = provider.get("models_url") or ai_endpoint(settings["base_url"], "models")
        http_request = urllib_request.Request(models_url, headers=headers)
        try:
            with urllib_request.urlopen(http_request, timeout=20) as response:
                payload = json.loads(response.read().decode("utf-8"))
            if provider["protocol"] == "gemini":
                raw_models = payload.get("models", []) if isinstance(payload, dict) else []
            else:
                raw_models = payload.get("data", []) if isinstance(payload, dict) else []
            from_provider = bool(raw_models)
            model_source = "供应商模型接口"
        except urllib_error.HTTPError as exc:
            if exc.code in {401, 403}:
                raise HTTPException(status_code=503, detail="API Key 无效或没有读取模型列表的权限。") from exc
            raise HTTPException(status_code=502, detail=f"供应商模型列表请求失败（HTTP {exc.code}）。") from exc
        except (urllib_error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=502, detail="无法连接供应商的模型列表接口。") from exc
    if not raw_models:
        raw_models = public_rows or list(catalog.values())
    if not raw_models:
        raise HTTPException(status_code=502, detail="公共模型目录暂时不可用；请联网后重试，或填写 API Key 从供应商读取。")
    models = []
    for item in raw_models if isinstance(raw_models, list) else []:
        if not isinstance(item, dict):
            continue
        model_id = item.get("id") or item.get("name")
        if not isinstance(model_id, str):
            continue
        if provider["protocol"] == "gemini":
            if from_provider and "generateContent" not in item.get("supportedGenerationMethods", []):
                continue
            model_id = model_id.removeprefix("models/")
        metadata = catalog_entry(catalog, model_id)
        if model_id.startswith("ft:"):
            continue
        deprecation_date = str(metadata.get("deprecation_date") or "")
        try:
            if deprecation_date and date.fromisoformat(deprecation_date) <= date.today():
                continue
        except ValueError:
            pass
        mode = str(metadata.get("mode") or "")
        if mode and mode not in {"chat", "completion"}:
            continue
        supported_endpoints = metadata.get("supported_endpoints") if isinstance(metadata.get("supported_endpoints"), list) else []
        if metadata and supported_endpoints and "/v1/chat/completions" not in supported_endpoints and provider["protocol"] not in {"gemini", "anthropic"}:
            continue
        pricing = item.get("pricing") if isinstance(item.get("pricing"), dict) else {}
        def per_million(field: str) -> float | None:
            try:
                return round(float(pricing[field]) * 1_000_000, 8)
            except (KeyError, TypeError, ValueError):
                return None
        direct_input = per_million("prompt") if settings["provider"] == "openrouter" else None
        direct_output = per_million("completion") if settings["provider"] == "openrouter" else None
        catalog_input, catalog_cached, catalog_output = catalog_price(catalog, model_id)
        registry_model = provider_catalog.get(model_id, {})
        registry_cost = registry_model.get("cost", {})
        if registry_cost:
            catalog_input = registry_cost.get("input")
            catalog_cached = registry_cost.get("cache_read")
            catalog_output = registry_cost.get("output")
        input_usd = direct_input if direct_input is not None else catalog_input
        output_usd = direct_output if direct_output is not None else catalog_output
        pricing_source = "供应商模型接口" if direct_input is not None or direct_output is not None else "Models.dev 社区参考价格" if registry_cost else "LiteLLM 动态价格目录" if any(value is not None for value in (catalog_input, catalog_cached, catalog_output)) else "供应商未提供"
        models.append({
            "id": model_id, "name": str(registry_model.get("name") or item.get("displayName") or item.get("name") or model_id).removeprefix("models/"),
            "release_date": registry_model.get("release_date", ""),
            "owned_by": str(item.get("owned_by") or ""),
            "input_price": round(input_usd * cny_rate, 8) if input_usd is not None else None,
            "cached_input_price": round(catalog_cached * cny_rate, 8) if catalog_cached is not None else None,
            "output_price": round(output_usd * cny_rate, 8) if output_usd is not None else None,
            "currency": "CNY", "pricing_source": pricing_source,
            "exchange_source": exchange_source, "model_source": model_source,
            "account_verified": from_provider,
            "catalog_checked_at": datetime.now(timezone.utc).isoformat() if from_provider else AI_METADATA_DATES.get("models-dev-providers-v1" if public_rows else f"litellm:{provider.get('pricing_provider', '')}", ""),
        })
    return sorted(models, key=lambda item: (item["name"].casefold(), item["id"]))
