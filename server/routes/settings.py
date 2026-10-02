from typing import Any
from fastapi import APIRouter, Request
from server.schemas import AiSettingsRequest
from server.services.ai_settings import public_ai_settings, save_ai_settings
from server.services.model_catalog import fetch_ai_models
from server.routes.context import require_desktop_management

router = APIRouter()
@router.get("/api/ai/settings")
def get_ai_settings(request: Request) -> dict[str, Any]:
    require_desktop_management(request)
    return public_ai_settings()


@router.put("/api/ai/settings")
def update_ai_settings(payload: AiSettingsRequest, request: Request) -> dict[str, Any]:
    require_desktop_management(request)
    return save_ai_settings(payload)


@router.post("/api/ai/models")
def list_ai_models(payload: AiSettingsRequest, request: Request) -> dict[str, Any]:
    require_desktop_management(request)
    return {"models": fetch_ai_models(payload)}
