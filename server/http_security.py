"""Credential-bearing requests never redirect or use remote plaintext HTTP."""
import ipaddress
from urllib import parse, request
from fastapi import HTTPException


def validate_api_url(value: str) -> str:
    try:
        if not isinstance(value, str) or any(char.isspace() or ord(char) < 32 for char in value) or "\\" in value:
            raise ValueError()
        url = parse.urlsplit(value)
        if url.scheme not in {"https", "http"} or not url.hostname or url.username is not None or url.password is not None or url.query or url.fragment:
            raise ValueError()
        if url.port is not None and not 1 <= url.port <= 65535:
            raise ValueError()
        try:
            address = ipaddress.ip_address(url.hostname)
        except ValueError:
            address = None
        if address and (address.is_link_local or address.is_multicast or address.is_unspecified):
            raise ValueError()
        local = url.hostname == "localhost" or bool(address and address.is_loopback)
        if url.scheme == "http" and not local:
            raise ValueError()
    except (ValueError, TypeError):
        raise HTTPException(422, "API 地址必须使用 HTTPS；仅本机回环地址可使用 HTTP，且不能包含账号、查询参数或锚点。") from None
    return value.rstrip("/")


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def open_credential_request(outgoing, *, timeout):
    validate_api_url(outgoing.full_url)
    return request.build_opener(NoRedirect()).open(outgoing, timeout=timeout)
