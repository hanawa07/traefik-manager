import time
import httpx
import logging
from typing import Any

logger = logging.getLogger(__name__)

async def check_upstream(host: str, port: int, timeout: float = 3.0) -> dict[str, Any]:
    """
    지정된 호스트와 포트로 HTTP GET 요청을 보내 상태를 확인합니다.
    """
    url = f"http://{host}:{port}/"
    start_time = time.perf_counter()
    
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False) as client:
            response = await client.get(url)
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            
            return {
                "status": "up",
                "status_code": response.status_code,
                "latency_ms": latency_ms,
            }
    except httpx.ConnectError as e:
        return {"status": "down", "error": f"Connection refused: {str(e)}"}
    except httpx.TimeoutException:
        return {"status": "down", "error": "Request timeout"}
    except Exception as e:
        logger.error(f"Unexpected error during health check for {url}: {e}")
        return {"status": "down", "error": str(e)}
