from typing import Any

from fastapi import HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def verify_token_handler(
    *,
    request: Request,
    db: AsyncSession,
    service_model: type[Any],
    resolve_authenticated_user_func,
) -> Response:
    auth_header = request.headers.get("Authorization", "")
    forwarded_host = request.headers.get("X-Forwarded-Host")

    if auth_header.startswith("Bearer ") and forwarded_host:
        token = auth_header[7:]
        result = await db.execute(
            select(service_model).where(service_model.domain == forwarded_host)
        )
        service = result.scalar_one_or_none()

        if service and service.auth_mode == "token" and service.api_key == token:
            return Response(
                status_code=200,
                headers={
                    "X-Auth-User": f"api-key-{service.name}",
                    "X-Auth-Role": "api",
                },
            )

    try:
        user, _auth_session = await resolve_authenticated_user_func(request=request, db=db)
        return Response(
            status_code=200,
            headers={
                "X-Auth-User": user.username,
                "X-Auth-Role": user.role,
            },
        )
    except HTTPException:
        return Response(status_code=401)
