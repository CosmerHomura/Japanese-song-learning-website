"""Separate the desktop management session from public local annotation routes."""

import hmac

from fastapi import HTTPException, Request


def require_paid_ai_access(request: Request, desktop_token: str) -> None:
    """In a desktop session, paid AI calls must come through the Electron bridge.

    Standalone web development has no desktop token and continues to use the
    locally configured development API. The token is never exposed to JS.
    """
    if desktop_token and not hmac.compare_digest(
        request.headers.get("x-uta-desktop-token", ""), desktop_token
    ):
        raise HTTPException(status_code=403, detail="AI 请求仅允许由当前 UTA 桌面会话发起。")
