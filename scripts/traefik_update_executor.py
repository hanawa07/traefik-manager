import json
import os
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from traefik_update_models import (
    VERSION_PATTERN,
    Preflight,
    RunnerConfig,
    UpdateRejectedError,
    UpdateRequest,
    ValidationError,
    is_forward_patch,
    message,
    utc_now,
    version_from_image,
)
from traefik_update_storage import (
    append_history,
    atomic_write,
    history_entry,
    write_heartbeat,
)


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
            config.compose_file,
            preflight.current_image,
            preflight.target_image,
        )
        write_heartbeat(
            config,
            "running",
            f"{request.target_version} 이미지를 적용하는 중입니다",
        )
        _run_compose(config, "pull")
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


def _preflight(config: RunnerConfig, target_version: str) -> Preflight:
    if not config.compose_file.is_file() or not config.acme_file.is_file():
        raise UpdateRejectedError("Compose 또는 ACME 파일을 찾을 수 없습니다")
    if (
        config.compose_dir not in config.compose_file.parents
        or config.compose_dir not in config.acme_file.parents
    ):
        raise UpdateRejectedError(
            "업데이트 대상 파일이 Traefik Compose 디렉터리 밖에 있습니다"
        )
    if config.acme_file.stat().st_size == 0:
        raise UpdateRejectedError("ACME 저장소가 비어 있습니다")

    current_image = _docker_inspect(config, "{{.Config.Image}}")
    current_version = version_from_image(current_image)
    if current_version != target_version and not is_forward_patch(
        current_version,
        target_version,
    ):
        raise UpdateRejectedError(
            "동일 메이저·마이너의 상향 패치 업데이트만 허용합니다"
        )
    repository = current_image.rsplit(":", 1)[0]
    if repository not in {
        "traefik",
        "docker.io/library/traefik",
        "registry-1.docker.io/library/traefik",
    }:
        raise UpdateRejectedError("Traefik 공식 이미지 계열만 업데이트할 수 있습니다")
    networks = json.loads(
        _docker_inspect(config, "{{json .NetworkSettings.Networks}}")
    )
    if not isinstance(networks, dict) or config.network not in networks:
        raise UpdateRejectedError(
            f"{config.network} 네트워크 연결을 확인할 수 없습니다"
        )
    services = _run(
        [
            config.docker_bin,
            "compose",
            "-f",
            str(config.compose_file),
            "config",
            "--services",
        ]
    ).splitlines()
    if config.service not in services:
        raise UpdateRejectedError("Traefik Compose 서비스를 확인할 수 없습니다")
    target_image = f"{repository}:{target_version}"
    compose_text = config.compose_file.read_text(encoding="utf-8")
    if compose_text.count(f"image: {current_image}") != 1:
        raise UpdateRejectedError(
            "Compose의 현재 Traefik 이미지 태그를 정확히 찾지 못했습니다"
        )
    return Preflight(current_image, current_version, target_image)


def _create_backup(config: RunnerConfig, request_id: str) -> Path:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    backup_dir = (
        config.compose_dir
        / "backups"
        / f"traefik-manager-{timestamp}-{request_id[:8]}"
    )
    backup_dir.mkdir(mode=0o700, parents=True, exist_ok=False)
    try:
        shutil.copy2(config.compose_file, backup_dir / config.compose_file.name)
        shutil.copy2(config.acme_file, backup_dir / "acme.json")
    except Exception:
        shutil.rmtree(backup_dir, ignore_errors=True)
        raise
    return backup_dir


def _replace_compose_image(
    path: Path,
    current_image: str,
    target_image: str,
) -> None:
    current = path.read_text(encoding="utf-8")
    needle = f"image: {current_image}"
    if current.count(needle) != 1:
        raise UpdateRejectedError(
            "Compose 이미지 태그가 사전 점검 이후 변경되었습니다"
        )
    atomic_write(
        path,
        current.replace(needle, f"image: {target_image}", 1),
        path.stat().st_mode & 0o777,
    )


def _run_compose(config: RunnerConfig, action: str, *arguments: str) -> None:
    _run(
        [
            config.docker_bin,
            "compose",
            "-f",
            str(config.compose_file),
            action,
            *arguments,
            config.service,
        ],
        timeout=600,
    )


def _validate_runtime(
    config: RunnerConfig,
    expected_version: str,
) -> list[dict[str, str]]:
    last_checks: list[dict[str, str]] = []
    for _ in range(20):
        last_checks = _runtime_checks(config, expected_version)
        if all(check["status"] == "ok" for check in last_checks):
            return last_checks
        time.sleep(1)
    raise ValidationError("업데이트 후 런타임 검증에 실패했습니다", last_checks)


def _runtime_checks(
    config: RunnerConfig,
    expected_version: str,
) -> list[dict[str, str]]:
    checks: list[dict[str, str]] = []
    running = _safe_inspect(config, "{{.State.Running}}") == "true"
    checks.append(
        _validation("container_running", running, "Traefik 컨테이너 실행 상태")
    )
    version = _safe_current_version(config)
    checks.append(
        _validation(
            "container_version",
            version == expected_version,
            f"컨테이너 버전 {version or '확인 실패'}",
        )
    )
    network_value = _safe_inspect(
        config,
        "{{json .NetworkSettings.Networks}}",
    )
    try:
        networks = json.loads(network_value or "null")
    except json.JSONDecodeError:
        networks = None
    checks.append(
        _validation(
            "proxy_network",
            isinstance(networks, dict) and config.network in networks,
            f"{config.network} 연결 상태",
        )
    )
    if config.manager_health_url:
        checks.append(
            _validation(
                "manager_route",
                _run_health_check(config),
                "Traefik 경유 Manager 공개 헬스 체크",
            )
        )
    return checks


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
        backup_compose = backup_dir / config.compose_file.name
        atomic_write(
            config.compose_file,
            backup_compose.read_text(encoding="utf-8"),
            backup_compose.stat().st_mode & 0o777,
        )
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
            "validations": [*validations, *rollback_validations],
        },
    )
    return rollback_status


def _run(command: list[str], *, timeout: int = 30) -> str:
    completed = subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if completed.returncode != 0:
        detail = (
            completed.stderr.strip()
            or completed.stdout.strip()
            or f"exit {completed.returncode}"
        )
        raise RuntimeError(message(detail))
    return completed.stdout.strip()


def _docker_inspect(config: RunnerConfig, template: str) -> str:
    return _run(
        [config.docker_bin, "inspect", "--format", template, config.container]
    )


def _safe_inspect(config: RunnerConfig, template: str) -> str | None:
    try:
        return _docker_inspect(config, template)
    except (OSError, RuntimeError, subprocess.SubprocessError):
        return None


def _safe_current_version(config: RunnerConfig) -> str | None:
    label_version = _safe_inspect(
        config,
        '{{ index .Config.Labels "org.opencontainers.image.version" }}',
    )
    if label_version and VERSION_PATTERN.fullmatch(label_version):
        return label_version
    image = _safe_inspect(config, "{{.Config.Image}}")
    try:
        return version_from_image(image or "")
    except UpdateRejectedError:
        return None


def _run_health_check(config: RunnerConfig) -> bool:
    try:
        _run(
            [
                config.curl_bin,
                "--silent",
                "--show-error",
                "--fail",
                "--max-time",
                "10",
                config.manager_health_url,
            ],
            timeout=15,
        )
        return True
    except (OSError, RuntimeError, subprocess.SubprocessError):
        return False


def _validation(key: str, passed: bool, detail: str) -> dict[str, str]:
    return {
        "key": key,
        "status": "ok" if passed else "fail",
        "message": detail,
    }
