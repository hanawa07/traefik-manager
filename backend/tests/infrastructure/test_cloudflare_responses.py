import httpx
import pytest

from app.infrastructure.cloudflare.client import CloudflareClient, CloudflareClientError


def make_response(status_code: int, payload: dict | list | None = None, content: bytes | None = None) -> httpx.Response:
    request = httpx.Request("GET", "https://api.cloudflare.com/client/v4/zones/zone")
    if content is not None:
        return httpx.Response(status_code, content=content, request=request)
    return httpx.Response(status_code, json=payload, request=request)


@pytest.mark.asyncio
async def test_decode_response_returns_success_payload():
    payload = {"success": True, "result": {"id": "record-id"}}

    result = await CloudflareClient._decode_response(make_response(200, payload))

    assert result == payload


@pytest.mark.asyncio
async def test_decode_response_uses_cloudflare_error_message_for_http_error():
    response = make_response(
        403,
        {"success": False, "errors": [{"message": "permission denied"}]},
    )

    with pytest.raises(CloudflareClientError, match="permission denied"):
        await CloudflareClient._decode_response(response)


@pytest.mark.asyncio
async def test_decode_response_raises_for_unsuccessful_cloudflare_payload():
    response = make_response(
        200,
        {"success": False, "errors": [{"message": "invalid dns record"}]},
    )

    with pytest.raises(CloudflareClientError, match="invalid dns record"):
        await CloudflareClient._decode_response(response)


@pytest.mark.asyncio
async def test_decode_response_rejects_invalid_json_payload():
    with pytest.raises(CloudflareClientError, match="응답 처리"):
        await CloudflareClient._decode_response(make_response(200, content=b"not-json"))
