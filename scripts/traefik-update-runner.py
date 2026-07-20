#!/usr/bin/env python3
import fcntl
import json
import os
import subprocess
import sys
from pathlib import Path

from traefik_update_executor import process_request
from traefik_update_models import ALERT_RETRY_OPERATION, RunnerConfig, UpdateRequest, message
from traefik_update_storage import (
    append_alert_result,
    read_request,
    validate_alert_retry,
    write_heartbeat,
)


def main() -> int:
    try:
        config = RunnerConfig.from_environment()
        config.state_dir.mkdir(parents=True, exist_ok=True)
        config.request_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    except (OSError, ValueError) as exc:
        print(f"Traefik 업데이트 실행기 설정 오류: {exc}", file=sys.stderr)
        return 1

    lock_path = config.state_dir / "traefik-update-runner.lock"
    with lock_path.open("a", encoding="utf-8") as lock_file:
        try:
            fcntl.flock(lock_file, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return 0
        return _run_once(config)


def _run_once(config: RunnerConfig) -> int:
    if not config.request_path.exists():
        write_heartbeat(
            config,
            "ready",
            "Traefik 패치 업데이트 요청을 기다리는 중입니다",
        )
        return 0
    try:
        request = read_request(config.request_path)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        write_heartbeat(
            config,
            "error",
            f"업데이트 요청 파일 검증 실패: {message(exc)}",
        )
        config.request_path.unlink(missing_ok=True)
        return 1

    try:
        if request.operation == ALERT_RETRY_OPERATION:
            return _retry_rollback_alert(config, request)
        write_heartbeat(
            config,
            "running",
            f"{request.target_version} 업데이트를 처리하는 중입니다",
        )
        result = process_request(config, request)
    except Exception as exc:
        write_heartbeat(
            config,
            "error",
            f"업데이트 실행기 내부 오류: {message(exc)}",
        )
        return 1
    finally:
        config.request_path.unlink(missing_ok=True)
    if result == "rollback_failed":
        _, detail = _request_and_record_rollback_alert(
            config,
            request.request_id,
            request.target_version,
        )
        write_heartbeat(
            config,
            "error",
            f"업데이트와 자동 롤백에 실패했습니다. {detail}",
        )
        return 1
    write_heartbeat(config, "ready", f"마지막 업데이트 결과: {result}")
    return 0


def _retry_rollback_alert(config: RunnerConfig, request: UpdateRequest) -> int:
    source_request_id = request.source_request_id
    if source_request_id is None:
        raise ValueError("알림 재시도 원본 요청 ID가 없습니다")
    validate_alert_retry(config, source_request_id, request.target_version)
    write_heartbeat(config, "running", "자동 롤백 실패 운영 알림을 다시 요청하는 중입니다")
    succeeded, detail = _request_and_record_rollback_alert(
        config,
        source_request_id,
        request.target_version,
        retry_actor=request.actor,
        retry_requested_at=request.requested_at,
    )
    write_heartbeat(
        config,
        "ready" if succeeded else "error",
        f"롤백 실패 알림 재시도 {'완료' if succeeded else '실패'}: {detail}",
    )
    return 0 if succeeded else 1


def _request_and_record_rollback_alert(
    config: RunnerConfig,
    request_id: str,
    target_version: str,
    retry_actor: str | None = None,
    retry_requested_at: str | None = None,
) -> tuple[bool, str]:
    alert_status = "request_failed"
    alert_url = None
    try:
        alert_url = _request_rollback_failure_alert(request_id, target_version)
        alert_status = "requested"
        detail = f"호스트 운영 알림 요청 완료: {alert_url}"
    except (OSError, RuntimeError, subprocess.SubprocessError) as exc:
        detail = f"호스트 운영 알림 요청도 실패했습니다: {message(exc)}"
    try:
        append_alert_result(
            config,
            request_id,
            target_version,
            alert_status,
            alert_url,
            retry_actor=retry_actor,
            retry_requested_at=retry_requested_at,
        )
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        return False, f"{detail}. 알림 결과 이력 저장 실패: {message(exc)}"
    return alert_status == "requested", detail


def _request_rollback_failure_alert(request_id: str, target_version: str) -> str:
    alert_script = os.environ.get(
        "TM_HOST_OPERATION_ALERT_SCRIPT",
        str(Path(__file__).resolve().with_name("request-host-operation-alert.sh")),
    )
    completed = subprocess.run(
        [
            alert_script,
            "Traefik 패치 업데이트 자동 롤백",
            f"{target_version} 업데이트와 자동 롤백 실패 · 요청 {request_id}",
            "failure",
        ],
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or f"exit {completed.returncode}")
    run_url = completed.stdout.strip()
    if not run_url:
        raise RuntimeError("호스트 운영 알림 실행 URL을 확인하지 못했습니다")
    return run_url


if __name__ == "__main__":
    raise SystemExit(main())
