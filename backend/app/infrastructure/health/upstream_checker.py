import time
import httpx
import logging
from typing import Any
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def _classify_connect_error(error: httpx.ConnectError) -> str:
    message = str(error)
    lowered = message.lower()
    if "name resolution" in lowered or "name or service not known" in lowered or "nodename nor servname" in lowered:
        return "DNS resolution failed"
    if "connection refused" in lowered:
        return "Connection refused"
    return f"Connection failed: {message}"


def _classify_connect_error_kind(error: httpx.ConnectError) -> str:
    message = str(error).lower()
    if "name resolution" in message or "name or service not known" in message or "nodename nor servname" in message:
        return "dns"
    if "connection refused" in message:
        return "connection_refused"
    return "connect"


def _checked_at_now() -> datetime:
    return datetime.now(timezone.utc)


async def check_upstream(
    host: str,
    port: int,
    scheme: str = "http",
    skip_tls_verify: bool = False,
    healthcheck_enabled: bool = True,
    healthcheck_path: str = "/",
    healthcheck_timeout_ms: int = 3000,
    healthcheck_expected_statuses: list[int] | None = None,
) -> dict[str, Any]:
    """
    지정된 호스트와 포트로 HTTP GET 요청을 보내 상태를 확인합니다.
    """
    checked_at = _checked_at_now()
    if not healthcheck_enabled:
        return {
            "status": "unknown",
            "status_code": None,
            "latency_ms": None,
            "error": "Health check disabled",
            "error_kind": "disabled",
            "checked_url": f"{scheme}://{host}:{port}/",
            "checked_at": checked_at.isoformat(),
        }

    path = healthcheck_path if healthcheck_path.startswith("/") else f"/{healthcheck_path}"
    url = f"{scheme}://{host}:{port}{path}"
    timeout_seconds = healthcheck_timeout_ms / 1000
    expected_statuses = sorted(set(healthcheck_expected_statuses or []))
    start_time = time.perf_counter()

    try:
        async with httpx.AsyncClient(
            timeout=timeout_seconds,
            follow_redirects=False,
            verify=not skip_tls_verify,
        ) as client:
            response = await client.get(url)
            latency_ms = int((time.perf_counter() - start_time) * 1000)

            if expected_statuses and response.status_code not in expected_statuses:
                return {
                    "status": "down",
                    "status_code": response.status_code,
                    "latency_ms": latency_ms,
                    "error": f"Unexpected status: {response.status_code}",
                    "error_kind": "unexpected_status",
                    "checked_url": url,
                    "checked_at": checked_at.isoformat(),
                }

            return {
                "status": "up",
                "status_code": response.status_code,
                "latency_ms": latency_ms,
                "error": None,
                "error_kind": None,
                "checked_url": url,
                "checked_at": checked_at.isoformat(),
            }
    except httpx.ConnectError as e:
        return {
            "status": "down",
            "status_code": None,
            "latency_ms": None,
            "error": _classify_connect_error(e),
            "error_kind": _classify_connect_error_kind(e),
            "checked_url": url,
            "checked_at": checked_at.isoformat(),
        }
    except httpx.ConnectTimeout:
        return {
            "status": "down",
            "status_code": None,
            "latency_ms": None,
            "error": "Connection timeout",
            "error_kind": "connection_timeout",
            "checked_url": url,
            "checked_at": checked_at.isoformat(),
        }
    except httpx.TimeoutException:
        return {
            "status": "down",
            "status_code": None,
            "latency_ms": None,
            "error": "Request timeout",
            "error_kind": "request_timeout",
            "checked_url": url,
            "checked_at": checked_at.isoformat(),
        }
    except Exception as e:
        logger.error(f"Unexpected error during health check for {url}: {e}")
        return {
            "status": "down",
            "status_code": None,
            "latency_ms": None,
            "error": str(e),
            "error_kind": "unexpected_error",
            "checked_url": url,
            "checked_at": checked_at.isoformat(),
        }
