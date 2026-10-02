from pathlib import Path
from typing import Any
from fastapi import APIRouter, HTTPException, Request
from server.config import DATA_DIR, TOMOSHI_DB_PATH
from server.dictionary_installer import DictionaryInstaller
from server.schemas import LocalDictionaryInstallRequest
from server.routes.context import require_desktop_management
from server.services.dictionary import DICTIONARY_LOCK

router = APIRouter()
DICTIONARY_INSTALLER = DictionaryInstaller(DATA_DIR, TOMOSHI_DB_PATH, database_lock=DICTIONARY_LOCK)
@router.get("/api/dictionary/status")
def dictionary_install_status() -> dict[str, Any]:
    return DICTIONARY_INSTALLER.status()


@router.post("/api/dictionary/install-download")
def install_dictionary_download(request: Request) -> dict[str, Any]:
    require_desktop_management(request)
    try:
        return DICTIONARY_INSTALLER.start_download()
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@router.post("/api/dictionary/cancel")
def cancel_dictionary_install(request: Request) -> dict[str, Any]:
    require_desktop_management(request)
    return DICTIONARY_INSTALLER.cancel()


@router.post("/api/dictionary/install-local")
def install_dictionary_local(payload: LocalDictionaryInstallRequest, request: Request) -> dict[str, Any]:
    require_desktop_management(request)
    try:
        return DICTIONARY_INSTALLER.start_local_install(Path(payload.path))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
