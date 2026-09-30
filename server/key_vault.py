"""API secrets protected by Windows DPAPI for the current Windows account."""
import ctypes
import base64
import os
from ctypes import wintypes


class Blob(ctypes.Structure):
    _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_byte))]


def protect(secret: str) -> str:
    if os.name != "nt":
        raise RuntimeError("本机密钥保护目前仅支持 Windows。")
    data = secret.encode("utf-8")
    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte)))
    output = Blob()
    if not ctypes.windll.crypt32.CryptProtectData(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(output)):
        raise ctypes.WinError()
    try:
        return base64.b64encode(ctypes.string_at(output.data, output.size)).decode("ascii")
    finally:
        ctypes.windll.kernel32.LocalFree(output.data)


def reveal(encrypted: str) -> str:
    data = base64.b64decode(encrypted)
    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte)))
    output = Blob()
    if not ctypes.windll.crypt32.CryptUnprotectData(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(output)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(output.data, output.size).decode("utf-8")
    finally:
        ctypes.windll.kernel32.LocalFree(output.data)
