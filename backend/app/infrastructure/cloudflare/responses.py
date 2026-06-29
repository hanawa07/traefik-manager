import httpx

from app.infrastructure.cloudflare.errors import CloudflareClientError


async def decode_cloudflare_response(response: httpx.Response) -> dict:
    try:
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPStatusError as exc:
        message = None
        try:
            payload = response.json()
        except ValueError:
            payload = None
        if isinstance(payload, dict):
            errors = payload.get("errors", [])
            if errors and isinstance(errors[0], dict):
                candidate = errors[0].get("message")
                if isinstance(candidate, str) and candidate.strip():
                    message = candidate.strip()
        detail = message or f"HTTP {response.status_code}"
        raise CloudflareClientError(f"Cloudflare API 오류 ({response.status_code}): {detail}") from exc
    except (httpx.HTTPError, ValueError) as exc:
        raise CloudflareClientError("Cloudflare API 응답 처리에 실패했습니다") from exc

    if not isinstance(payload, dict):
        raise CloudflareClientError("Cloudflare API 응답 처리에 실패했습니다")

    if not payload.get("success", False):
        errors = payload.get("errors", [])
        message = errors[0].get("message") if errors and isinstance(errors[0], dict) else "알 수 없는 오류"
        raise CloudflareClientError(f"Cloudflare API 오류: {message}")

    return payload
