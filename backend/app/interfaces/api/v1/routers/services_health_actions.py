import asyncio
from uuid import UUID

from fastapi import HTTPException, status

from app.application.proxy.service_use_cases import ServiceUseCases
from app.interfaces.api.v1.schemas.service_schemas import UpstreamHealthResponse


async def list_services_health_action(
    *,
    use_cases: ServiceUseCases,
    upstream_checker,
) -> dict[str, UpstreamHealthResponse]:
    services = await use_cases.list_services()
    health_results = await asyncio.gather(
        *(_check_service_upstream(service, upstream_checker) for service in services)
    )

    return {
        str(service.id): UpstreamHealthResponse(
            service_id=service.id.value,
            domain=str(service.domain),
            **result,
        )
        for service, result in zip(services, health_results)
    }


async def get_service_health_action(
    *,
    service_id: UUID,
    use_cases: ServiceUseCases,
    upstream_checker,
) -> UpstreamHealthResponse:
    service = await use_cases.get_service(service_id)
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")

    result = await _check_service_upstream(service, upstream_checker)

    return UpstreamHealthResponse(
        service_id=service.id.value,
        domain=str(service.domain),
        **result,
    )


async def _check_service_upstream(service, upstream_checker):
    return await upstream_checker.check_upstream(
        service.upstream_host,
        service.upstream_port,
        service.upstream_scheme,
        service.skip_tls_verify,
        service.healthcheck_enabled,
        service.healthcheck_path,
        service.healthcheck_timeout_ms,
        service.healthcheck_expected_statuses,
    )
