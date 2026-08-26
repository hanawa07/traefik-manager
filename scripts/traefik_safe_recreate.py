#!/usr/bin/env python3
import argparse
import os
import subprocess
import sys
from dataclasses import replace
from pathlib import Path
from urllib.parse import urlsplit

from traefik_recreate_audit import record_managed_recreation, safe_current_container_id
from traefik_recreate_checkpoint import (
    compose_config_hash,
    current_container_config_hash,
    ensure_runtime_checkpoint,
    restore_runtime_checkpoint,
    save_runtime_checkpoint,
)
from traefik_update_models import RunnerConfig, ValidationError, message
from traefik_update_runtime import _run_compose, _safe_current_version, _validate_runtime
from traefik_update_storage import write_heartbeat


def perform_recreate(config: RunnerConfig, force_recreate: bool, actor: str) -> str:
    current_version = _required_current_version(config)
    _validate_runtime(config, current_version)
    checkpoint = ensure_runtime_checkpoint(config, current_version)
    previous_container_id = safe_current_container_id(config)

    try:
        arguments = ["-d"]
        if force_recreate:
            arguments.append("--force-recreate")
        _run_compose(config, "up", *arguments)
        _validate_runtime(config, str(checkpoint["version"]))
        _require_runtime_compose_match(config)
    except Exception as update_error:
        audit_error = _record_recreation(config, previous_container_id, "manual_safe", actor)
        return _recover(
            config,
            checkpoint,
            previous_container_id,
            update_error,
            actor,
            audit_error,
        )

    metadata_errors = [
        error
        for error in (_record_recreation(config, previous_container_id, "manual_safe", actor),)
        if error
    ]
    try:
        save_runtime_checkpoint(config, str(checkpoint["version"]))
    except Exception as exc:
        metadata_errors.append(f"Traefik 정상 체크포인트 저장 실패: {message(exc)}")
    if metadata_errors:
        _write_heartbeat_safely(config, "error", " · ".join(metadata_errors))
        return "metadata_failed"
    heartbeat_error = _write_heartbeat_safely(
        config,
        "ready",
        "수동 안전 재생성과 런타임 검증을 완료했습니다",
    )
    return "metadata_failed" if heartbeat_error else "success"


def initialize_checkpoint(config: RunnerConfig) -> None:
    current_version = _required_current_version(config)
    _validate_runtime(config, current_version)
    ensure_runtime_checkpoint(config, current_version)
    write_heartbeat(config, "ready", "Traefik 마지막 정상 체크포인트를 확인했습니다")


def _recover(
    config: RunnerConfig,
    checkpoint: dict[str, object],
    original_container_id: str | None,
    update_error: Exception,
    actor: str,
    candidate_audit_error: str | None,
) -> str:
    rollback_container_id = safe_current_container_id(config)
    try:
        restore_runtime_checkpoint(config, checkpoint)
        current_container_id = safe_current_container_id(config)
        if current_container_id != original_container_id or not _runtime_is_valid(
            config, str(checkpoint["version"])
        ):
            rollback_container_id = current_container_id
            _run_compose(config, "up", "-d", "--force-recreate")
            _validate_runtime(config, str(checkpoint["version"]))
            _require_runtime_compose_match(config)
            rollback_audit_error = _record_recreation(
                config,
                rollback_container_id,
                "rollback",
                actor,
            )
        else:
            rollback_audit_error = None
    except Exception as rollback_error:
        _record_recreation(
            config,
            rollback_container_id,
            "rollback",
            actor,
        )
        alert_detail = _request_failure_alert(update_error, rollback_error)
        _write_heartbeat_safely(
            config,
            "error",
            f"수동 재생성과 자동 복구에 실패했습니다. {alert_detail}",
        )
        return "rollback_failed"

    audit_errors = [
        error for error in (candidate_audit_error, rollback_audit_error) if error
    ]
    _write_heartbeat_safely(
        config,
        "error" if audit_errors else "ready",
        (
            "수동 재생성 실패 후 마지막 정상 Compose로 자동 복구했습니다: "
            f"{message(update_error)}"
            + (f" · {' · '.join(audit_errors)}" if audit_errors else "")
        ),
    )
    return "rolled_back"


def _runtime_is_valid(config: RunnerConfig, expected_version: str) -> bool:
    try:
        _validate_runtime(config, expected_version)
        _require_runtime_compose_match(config)
        return True
    except (OSError, RuntimeError, ValueError, ValidationError, subprocess.SubprocessError):
        return False


def _require_runtime_compose_match(config: RunnerConfig) -> None:
    if current_container_config_hash(config) != compose_config_hash(config):
        raise RuntimeError("실행 중인 Traefik이 현재 Compose 구성과 일치하지 않습니다")


def _required_current_version(config: RunnerConfig) -> str:
    version = _safe_current_version(config)
    if version is None:
        raise RuntimeError("현재 Traefik 버전을 확인할 수 없습니다")
    return version


def _record_recreation(
    config: RunnerConfig,
    previous_container_id: str | None,
    source: str,
    actor: str,
) -> str | None:
    try:
        record_managed_recreation(
            config,
            previous_container_id,
            source,
            actor=actor,
        )
        return None
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError) as exc:
        return f"Traefik 재생성 이력 기록 실패: {message(exc)}"


def _write_heartbeat_safely(config: RunnerConfig, status: str, detail: str) -> str | None:
    try:
        write_heartbeat(config, status, detail)
        return None
    except (OSError, RuntimeError, ValueError) as exc:
        return f"Traefik 상태 기록 실패: {message(exc)}"


def _request_failure_alert(update_error: Exception, rollback_error: Exception) -> str:
    detail = (
        f"적용 오류: {message(update_error)} · 복구 오류: {message(rollback_error)}"
    )
    alert_script = os.environ.get(
        "TM_HOST_OPERATION_ALERT_SCRIPT",
        str(Path(__file__).resolve().with_name("request-host-operation-alert.sh")),
    )
    try:
        completed = subprocess.run(
            [alert_script, "Traefik 수동 안전 재생성", detail, "failure"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if completed.returncode == 0 and completed.stdout.strip() == "anubis":
            return f"{detail} · Anubis 알림 전송 완료"
        return f"{detail} · Anubis 알림 전송 실패"
    except (OSError, subprocess.SubprocessError):
        return f"{detail} · Anubis 알림 전송 실패"


def _with_default_manager_health_url(config: RunnerConfig) -> RunnerConfig:
    if config.manager_health_url:
        return config
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if not env_path.is_file():
        return config
    values: dict[str, str] = {}
    for line in env_path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key in {"TAILNET_FRONTEND_URL", "FRONTEND_DOMAIN"}:
            values[key] = value.strip().strip('"\'')
    raw = values.get("TAILNET_FRONTEND_URL") or values.get("FRONTEND_DOMAIN")
    if not raw:
        return config
    base_url = raw if raw.startswith(("http://", "https://")) else f"https://{raw}"
    parsed = urlsplit(base_url)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
    ):
        raise ValueError("Manager health URL이 올바르지 않습니다")
    health_url = base_url.rstrip("/")
    if not health_url.endswith("/api/health"):
        health_url = f"{health_url}/api/health"
    parsed = urlsplit(health_url)
    if parsed.path != "/api/health" or parsed.query or parsed.fragment:
        raise ValueError("Manager health URL이 올바르지 않습니다")
    return replace(config, manager_health_url=health_url)


def main() -> int:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--force-recreate", action="store_true")
    group.add_argument("--checkpoint", action="store_true")
    arguments = parser.parse_args()
    try:
        config = _with_default_manager_health_url(RunnerConfig.from_environment())
        config.state_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        if arguments.checkpoint:
            initialize_checkpoint(config)
            print("checkpoint-ready")
            return 0
        result = perform_recreate(
            config,
            arguments.force_recreate,
            os.environ.get("USER", "host"),
        )
    except Exception as exc:
        print(f"Traefik 안전 재생성 실패: {message(exc)}", file=sys.stderr)
        return 1
    if result == "success":
        print("recreated")
        return 0
    if result == "metadata_failed":
        print("Traefik 재생성은 완료했지만 운영 상태 기록에 실패했습니다", file=sys.stderr)
        return 1
    print(
        "Traefik 재생성 적용은 실패했지만 자동 복구했습니다"
        if result == "rolled_back"
        else "Traefik 재생성과 자동 복구에 실패했습니다",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
