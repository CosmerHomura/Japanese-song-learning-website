import hmac
from fastapi import HTTPException, Request
from server.config import DESKTOP_MANAGEMENT_TOKEN

def client_host(request: Request) -> str:
    return request.client.host if request.client else "local"

def require_desktop_management(request: Request) -> None:
    supplied_token = request.headers.get("x-uta-desktop-token", "")
    if not DESKTOP_MANAGEMENT_TOKEN or not hmac.compare_digest(supplied_token, DESKTOP_MANAGEMENT_TOKEN):
        raise HTTPException(status_code=403, detail="该操作只允许由 UTA 桌面端发起。")
