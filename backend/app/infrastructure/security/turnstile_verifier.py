import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


async def verify_token(
    *,
    token: str,
    secret_key: str,
    remote_ip: str | None = None,
) -> bool:
    if not token or not secret_key:
        return False

    payload = {
        "secret": secret_key,
        "response": token,
    }
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=settings.TURNSTILE_VERIFY_TIMEOUT_SECONDS) as client:
            response = await client.post(TURNSTILE_VERIFY_URL, data=payload)
            response.raise_for_status()
        body = response.json()
        return bool(body.get("success") is True)
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Turnstile 검증 실패: %s", exc, exc_info=True)
        return False
