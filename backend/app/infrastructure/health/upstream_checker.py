import time
import httpx
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _classify_connect_error(error: httpx.ConnectError) -> str:
    message = str(error)
    lowered = message.lower()
    if "name resolution" in lowered or "name or service not known" in lowered or "nodename nor servname" in lowered:
        return "DNS resolution failed"
    if "connection refused" in lowered:
        return "Connection refused"
    return f"Connection failed: {message}"


async def check_upstream(
    host: str,
    port: int,
    scheme: str = "http",
    skip_tls_verify: bool = False,
    timeout: float = 3.0,
) -> dict[str, Any]:
    """
    지정된 호스트와 포트로 HTTP GET 요청을 보내 상태를 확인합니다.
    """
    url = f"{scheme}://{host}:{port}/"
    start_time = time.perf_counter()

    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=False,
            verify=not skip_tls_verify,
        ) as client:
            response = await client.get(url)
            latency_ms = int((time.perf_counter() - start_time) * 1000)

            return {
                "status": "up",
                "status_code": response.status_code,
                "latency_ms": latency_ms,
            }
    except httpx.ConnectError as e:
        return {"status": "down", "error": _classify_connect_error(e)}
    except httpx.ConnectTimeout:
        return {"status": "down", "error": "Connection timeout"}
    except httpx.TimeoutException:
        return {"status": "down", "error": "Request timeout"}
    except Exception as e:
        logger.error(f"Unexpected error during health check for {url}: {e}")
        return {"status": "down", "error": str(e)}
