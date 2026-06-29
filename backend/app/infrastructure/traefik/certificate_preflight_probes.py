import asyncio
import socket
import ssl

import httpx


async def resolve_public_dns_records(domain: str) -> dict:
    loop = asyncio.get_running_loop()
    try:
        infos = await loop.getaddrinfo(domain, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        return {
            "ok": False,
            "a_records": [],
            "aaaa_records": [],
            "error": str(exc),
        }

    a_records: set[str] = set()
    aaaa_records: set[str] = set()
    for family, *_rest, sockaddr in infos:
        if family == socket.AF_INET:
            a_records.add(sockaddr[0])
        elif family == socket.AF_INET6:
            aaaa_records.add(sockaddr[0])

    return {
        "ok": bool(a_records or aaaa_records),
        "a_records": sorted(a_records),
        "aaaa_records": sorted(aaaa_records),
        "error": None,
    }


async def probe_http_challenge_path(domain: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=5.0, follow_redirects=False) as client:
            response = await client.get(
                f"http://{domain}/.well-known/acme-challenge/traefik-manager-preflight",
                headers={"User-Agent": "TraefikManager/1.0"},
            )
    except httpx.HTTPError as exc:
        return {
            "ok": False,
            "status_code": None,
            "location": None,
            "error": str(exc),
        }

    return {
        "ok": True,
        "status_code": response.status_code,
        "location": response.headers.get("location"),
        "error": None,
    }


async def inspect_presented_certificate(domain: str) -> dict:
    ssl_context = ssl.create_default_context()
    writer = None
    try:
        _reader, writer = await asyncio.wait_for(
            asyncio.open_connection(domain, 443, ssl=ssl_context, server_hostname=domain),
            timeout=5.0,
        )
        ssl_object = writer.get_extra_info("ssl_object")
        peer_cert = ssl_object.getpeercert() if ssl_object else {}
        subject_common_name = extract_peer_common_name(peer_cert.get("subject", ()))
        issuer_common_name = extract_peer_common_name(peer_cert.get("issuer", ()))
        default_cert = (subject_common_name or "").upper() == "TRAEFIK DEFAULT CERT"
        return {
            "ok": True,
            "default_cert": default_cert,
            "subject_common_name": subject_common_name,
            "issuer_common_name": issuer_common_name,
            "error": None,
        }
    except Exception as exc:
        return {
            "ok": False,
            "default_cert": False,
            "subject_common_name": None,
            "issuer_common_name": None,
            "error": str(exc),
        }
    finally:
        if writer is not None:
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass


def extract_peer_common_name(entries) -> str | None:
    for rdn in entries:
        for key, value in rdn:
            if key == "commonName" and isinstance(value, str) and value:
                return value
    return None
