from typing import Any

from fastapi import HTTPException, status

from app.infrastructure.docker.traefik_deployment import is_patch_update


def require_runner_available(operations: dict[str, object]) -> None:
    runner = operations.get("runner")
    if isinstance(runner, dict) and runner.get("available"):
        return
    runner_message = runner.get("message") if isinstance(runner, dict) else None
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=runner_message or "Traefik 호스트 업데이트 실행기를 사용할 수 없습니다",
    )


def validate_safe_patch_request(deployment: dict[str, Any], target_version: str) -> None:
    if not deployment.get("enabled"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Traefik 배포 정보를 확인할 수 없습니다",
        )
    if deployment.get("target_version") != target_version:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="최신 버전이 변경되었습니다. 대시보드를 새로 확인하세요",
        )
    current_version = deployment.get("current_version")
    if not deployment.get("update_available"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="현재 Traefik은 이미 최신 버전입니다",
        )
    if not is_patch_update(current_version, target_version):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="자동 요청은 동일 메이저·마이너의 패치 업데이트만 허용합니다",
        )
    failed_checks = [
        check.get("label", "사전 점검")
        for check in deployment.get("checks", [])
        if check.get("status") == "fail"
    ]
    if failed_checks:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"업데이트 사전 점검 실패: {', '.join(failed_checks)}",
        )
