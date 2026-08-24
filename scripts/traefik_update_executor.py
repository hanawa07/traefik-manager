import time
from pathlib import Path
from typing import Any

from traefik_update_models import (
    Preflight,
    RunnerConfig,
    UpdateRequest,
    ValidationError,
    message,
    utc_now,
)
from traefik_update_preflight import (
    _compose_backup_path,
    _create_backup,
    _preflight,
    _replace_compose_image,
)
from traefik_update_runtime import (
    _run_compose,
    _safe_current_version,
    _validate_runtime,
)
from traefik_update_storage import (
    append_history,
    atomic_write,
    history_entry,
    write_heartbeat,
)
from traefik_recreate_window import seconds_until_safe_recreate


def process_request(config: RunnerConfig, request: UpdateRequest) -> str:
    started_at = utc_now()
    try:
        preflight = _preflight(config, request.target_version)
    except Exception as exc:
        current_version = _safe_current_version(config) or request.target_version
        entry = history_entry(request, started_at, current_version)
        append_history(
            config,
            {
                **entry,
                "status": "rejected",
                "completed_at": utc_now(),
                "message": f"업데이트 사전 점검 실패: {message(exc)}",
            },
        )
        return "rejected"

    entry = history_entry(request, started_at, preflight.current_version)
    if preflight.current_version == request.target_version:
        return _verify_already_applied(config, request, entry)

    append_history(
        config,
        {**entry, "status": "running", "message": "백업과 업데이트를 시작했습니다"},
    )
    try:
        backup_dir = _create_backup(config, request.request_id)
    except Exception as exc:
        append_history(
            config,
            {
                **entry,
                "status": "rejected",
                "completed_at": utc_now(),
                "message": f"업데이트 백업 생성 실패: {message(exc)}",
            },
        )
        return "rejected"
    try:
        _replace_compose_image(
            preflight.image_compose_file,
            preflight.current_image,
            preflight.target_image,
        )
        write_heartbeat(
            config,
            "running",
            f"{request.target_version} 이미지를 적용하는 중입니다",
        )
        _run_compose(config, "pull")
        _wait_for_recreate_window(config, request.target_version)
        _run_compose(config, "up", "-d")
        validations = _validate_runtime(config, request.target_version)
        append_history(
            config,
            {
                **entry,
                "status": "success",
                "completed_at": utc_now(),
                "message": "백업, 업데이트 적용, 런타임 검증을 완료했습니다",
                "backup_dir": str(backup_dir),
                "backup_created": True,
                "validations": validations,
            },
        )
        return "success"
    except Exception as exc:
        update_validations = exc.validations if isinstance(exc, ValidationError) else []
        return _rollback(
            config,
            entry,
            preflight,
            backup_dir,
            exc,
            update_validations,
        )


def _verify_already_applied(
    config: RunnerConfig,
    request: UpdateRequest,
    entry: dict[str, Any],
) -> str:
    try:
        validations = _validate_runtime(config, request.target_version)
        append_history(
            config,
            {
                **entry,
                "status": "success",
                "completed_at": utc_now(),
                "message": "대상 버전이 이미 적용되어 런타임 상태만 다시 검증했습니다",
                "validations": validations,
            },
        )
        return "success"
    except ValidationError as exc:
        append_history(
            config,
            {
                **entry,
                "status": "rejected",
                "completed_at": utc_now(),
                "message": message(exc),
                "validations": exc.validations,
            },
        )
        return "rejected"


def _rollback(
    config: RunnerConfig,
    entry: dict[str, Any],
    preflight: Preflight,
    backup_dir: Path | None,
    update_error: Exception,
    validations: list[dict[str, str]],
) -> str:
    rollback_validations: list[dict[str, str]] = []
    rollback_status = "rollback_failed"
    rollback_message = "자동 롤백을 완료하지 못했습니다"
    try:
        if backup_dir is None:
            raise RuntimeError("복원할 Compose 백업이 없습니다")
        _restore_compose_files(config, backup_dir)
        _run_compose(config, "up", "-d")
        rollback_validations = [
            {**check, "key": f"rollback_{check['key']}"}
            for check in _validate_runtime(config, preflight.current_version)
        ]
        rollback_status = "rolled_back"
        rollback_message = (
            "업데이트 검증 실패 후 이전 버전으로 자동 롤백했습니다"
        )
    except Exception as rollback_error:
        rollback_message = (
            "업데이트 실패 후 자동 롤백도 실패했습니다: "
            f"{message(rollback_error)}"
        )
        if isinstance(rollback_error, ValidationError):
            rollback_validations = [
                {**check, "key": f"rollback_{check['key']}"}
                for check in rollback_error.validations
            ]
    append_history(
        config,
        {
            **entry,
            "status": rollback_status,
            "completed_at": utc_now(),
            "message": f"{rollback_message} (원인: {message(update_error)})",
            "backup_dir": str(backup_dir) if backup_dir else None,
            "backup_created": backup_dir is not None,
            "rollback_performed": True,
            "alert_request_status": (
                "pending" if rollback_status == "rollback_failed" else "not_needed"
            ),
            "validations": [*validations, *rollback_validations],
        },
    )
    return rollback_status


def _wait_for_recreate_window(config: RunnerConfig, target_version: str) -> None:
    while wait_seconds := seconds_until_safe_recreate(
        guard_seconds=config.recreate_guard_seconds
    ):
        write_heartbeat(
            config,
            "running",
            f"15분 단위 운영 점검을 피해 {target_version} 적용을 약 {wait_seconds}초 대기합니다",
        )
        time.sleep(min(wait_seconds, 30))


def _restore_compose_files(config: RunnerConfig, backup_dir: Path) -> None:
    restore_entries: list[tuple[Path, str, int]] = []
    for compose_file in config.compose_files:
        backup_compose = _compose_backup_path(config, backup_dir, compose_file)
        restore_entries.append(
            (
                compose_file,
                backup_compose.read_text(encoding="utf-8"),
                backup_compose.stat().st_mode & 0o777,
            )
        )
    for compose_file, content, mode in restore_entries:
        atomic_write(compose_file, content, mode)
