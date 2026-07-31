from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status

from app.application.proxy.service_use_cases import ServiceUseCases
from app.interfaces.api.v1.routers.services_gateway_checks import (
    check_docker_network,
    check_traefik_router,
    check_upstream,
)
from app.interfaces.api.v1.schemas.service_schemas import (
    ServiceGatewayDiagnosisResponse,
)


SERVICE_GATEWAY_DIAGNOSIS_EVENT = "service_gateway_diagnosis"


async def diagnose_service_gateway_action(
    *,
    service_id: UUID,
    use_cases: ServiceUseCases,
    upstream_checker,
    traefik_client,
    docker_client,
) -> ServiceGatewayDiagnosisResponse:
    service = await use_cases.get_service(service_id)
    if not service:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="서비스를 찾을 수 없습니다")

    if service.routing_mode != "active":
        return _build_intentional_routing_diagnosis(service)

    checks = [
        await check_traefik_router(service, traefik_client),
        await check_upstream(service, upstream_checker),
        await check_docker_network(service, docker_client),
    ]
    status_value = _summarize_status(checks)
    return ServiceGatewayDiagnosisResponse(
        service_id=service.id.value if hasattr(service.id, "value") else service.id,
        domain=str(service.domain),
        status=status_value,
        summary=_build_summary(status_value),
        checked_at=datetime.now(timezone.utc),
        checks=checks,
    )


async def record_service_gateway_diagnosis_action(
    *,
    service_id: UUID,
    use_cases: ServiceUseCases,
    upstream_checker,
    traefik_client,
    docker_client,
    db,
    current_user: dict,
    audit_service,
) -> ServiceGatewayDiagnosisResponse:
    result = await diagnose_service_gateway_action(
        service_id=service_id,
        use_cases=use_cases,
        upstream_checker=upstream_checker,
        traefik_client=traefik_client,
        docker_client=docker_client,
    )
    await audit_service.record(
        db=db,
        actor=current_user["username"],
        action="test",
        resource_type="service",
        resource_id=str(service_id),
        resource_name=result.domain,
        detail={
            "event": SERVICE_GATEWAY_DIAGNOSIS_EVENT,
            "domain": result.domain,
            "status": result.status,
            "summary": result.summary,
            "checked_at": result.checked_at.isoformat(),
            "checks": [check.model_dump() for check in result.checks],
        },
    )
    return result

def _build_intentional_routing_diagnosis(service) -> ServiceGatewayDiagnosisResponse:
    is_disabled = service.routing_mode == "disabled"
    label = "라우팅 비활성" if is_disabled else "점검 안내 중"
    message = (
        "Traefik 라우터와 업스트림 점검을 의도적으로 건너뜁니다."
        if is_disabled
        else "업스트림 대신 공개 점검 안내 페이지를 제공합니다."
    )
    return ServiceGatewayDiagnosisResponse(
        service_id=service.id.value if hasattr(service.id, "value") else service.id,
        domain=str(service.domain),
        status="ok",
        summary=f"{label} 상태가 적용되어 있습니다.",
        checked_at=datetime.now(timezone.utc),
        checks=[
            {
                "key": "routing_mode",
                "label": label,
                "status": "ok",
                "message": message,
                "details": {"routing_mode": service.routing_mode},
            }
        ],
    )


def _summarize_status(checks: list[dict]) -> str:
    statuses = {check["status"] for check in checks}
    if "fail" in statuses:
        return "fail"
    if "warning" in statuses:
        return "warning"
    return "ok"


def _build_summary(status_value: str) -> str:
    if status_value == "fail":
        return "Bad Gateway 가능성이 높은 항목이 있습니다."
    if status_value == "warning":
        return "라우팅은 가능하지만 추가 확인이 필요한 항목이 있습니다."
    return "Traefik 라우터, 업스트림 응답, Docker 네트워크가 정상입니다."
