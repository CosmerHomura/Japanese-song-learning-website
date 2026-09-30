"""Normalize provider usage and calculate local CNY cost estimates."""

from typing import Any

def normalize_provider_response(response_body: dict[str, Any], protocol: str, model: str) -> dict[str, Any]:
    if protocol == "anthropic":
        source = response_body.get("usage") if isinstance(response_body.get("usage"), dict) else {}
        usage = {
            "prompt_tokens": int(source.get("input_tokens") or 0),
            "completion_tokens": int(source.get("output_tokens") or 0),
            "prompt_cache_hit_tokens": int(source.get("cache_read_input_tokens") or 0),
        }
        usage["total_tokens"] = usage["prompt_tokens"] + usage["completion_tokens"]
        return {**response_body, "model": response_body.get("model") or model, "usage": usage}
    if protocol == "gemini":
        source = response_body.get("usageMetadata") if isinstance(response_body.get("usageMetadata"), dict) else {}
        return {
            **response_body,
            "model": response_body.get("modelVersion") or model,
            "usage": {
                "prompt_tokens": int(source.get("promptTokenCount") or 0),
                "completion_tokens": int(source.get("candidatesTokenCount") or 0),
                "prompt_cache_hit_tokens": int(source.get("cachedContentTokenCount") or 0),
                "total_tokens": int(source.get("totalTokenCount") or 0),
            },
        }
    return response_body


def billing_from_response(response_body: dict[str, Any], settings: dict[str, Any], usd_to_cny_rate) -> dict[str, Any]:
    usage = response_body.get("usage") if isinstance(response_body.get("usage"), dict) else {}
    prompt_tokens = int(usage.get("prompt_tokens") or 0)
    completion_tokens = int(usage.get("completion_tokens") or 0)
    details = usage.get("prompt_tokens_details") if isinstance(usage.get("prompt_tokens_details"), dict) else {}
    cached_tokens = int(usage.get("prompt_cache_hit_tokens") or details.get("cached_tokens") or 0)
    uncached_tokens = max(0, prompt_tokens - cached_tokens)
    estimated_cost = (
        uncached_tokens * settings["input_price"]
        + cached_tokens * settings["cached_input_price"]
        + completion_tokens * settings["output_price"]
    ) / 1_000_000
    provider_cost = usage.get("cost")
    try:
        cost = float(provider_cost) if provider_cost is not None else estimated_cost
        if provider_cost is not None and settings["provider"] == "openrouter":
            cost *= usd_to_cny_rate()[0]
        is_estimate = provider_cost is None
    except (TypeError, ValueError):
        cost, is_estimate = estimated_cost, True
    return {
        "provider": settings["provider"], "model": str(response_body.get("model") or settings["model"]),
        "prompt_tokens": prompt_tokens, "cached_prompt_tokens": cached_tokens,
        "completion_tokens": completion_tokens, "total_tokens": int(usage.get("total_tokens") or prompt_tokens + completion_tokens),
        "currency": settings["currency"], "estimated_cost": round(cost, 8),
        "estimated": is_estimate, "cache_reused": False, "billed_request": True,
    }
