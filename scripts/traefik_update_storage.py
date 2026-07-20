import json
import os
import re
from pathlib import Path
from typing import Any
from uuid import UUID

from traefik_update_models import (
    ALERT_RETRY_OPERATION,
    MAX_HISTORY_LINES,
    MAX_REQUEST_BYTES,
    PATCH_UPDATE_OPERATION,
    VERSION_PATTERN,
    RunnerConfig,
    UpdateRequest,
    parse_datetime,
    utc_now,
)

ALERT_RUN_URL_PATTERN = re.compile(
    r"^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/actions/runs/[1-9][0-9]*$"
)


def read_request(path: Path) -> UpdateRequest:
    stat = path.lstat()
    if path.is_symlink() or not path.is_file() or stat.st_size > MAX_REQUEST_BYTES:
        raise ValueError("요청 파일 형식이 올바르지 않습니다")
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or raw.get("schema_version") != 1:
        raise ValueError("지원하지 않는 업데이트 요청입니다")
    operation = raw.get("operation")
    if operation not in {PATCH_UPDATE_OPERATION, ALERT_RETRY_OPERATION}:
        raise ValueError("지원하지 않는 업데이트 요청입니다")
    request_id = raw.get("request_id")
    target_version = raw.get("target_version")
    actor = raw.get("actor")
    requested_at = raw.get("requested_at")
    if not isinstance(request_id, str) or str(UUID(request_id)) != request_id:
        raise ValueError("요청 ID가 올바르지 않습니다")
    if not isinstance(target_version, str) or not VERSION_PATTERN.fullmatch(target_version):
        raise ValueError("대상 버전이 올바르지 않습니다")
    if (
        not isinstance(actor, str)
        or not actor
        or len(actor) > 100
        or any(ord(character) < 32 for character in actor)
    ):
        raise ValueError("요청자가 올바르지 않습니다")
    if not isinstance(requested_at, str) or parse_datetime(requested_at) is None:
        raise ValueError("요청 시각이 올바르지 않습니다")
    source_request_id = raw.get("source_request_id")
    if operation == ALERT_RETRY_OPERATION:
        if (
            not isinstance(source_request_id, str)
            or str(UUID(source_request_id)) != source_request_id
            or source_request_id == request_id
        ):
            raise ValueError("알림 재시도 원본 요청 ID가 올바르지 않습니다")
    elif source_request_id is not None:
        raise ValueError("패치 업데이트 요청에는 원본 요청 ID를 지정할 수 없습니다")
    return UpdateRequest(
        request_id,
        target_version,
        actor,
        requested_at,
        str(operation),
        source_request_id,
    )


def history_entry(
    request: UpdateRequest,
    started_at: str,
    current_version: str,
) -> dict[str, Any]:
    return {
        "request_id": request.request_id,
        "actor": request.actor,
        "status": "running",
        "from_version": current_version,
        "target_version": request.target_version,
        "requested_at": request.requested_at,
        "started_at": started_at,
        "completed_at": None,
        "message": "",
        "backup_dir": None,
        "backup_created": False,
        "rollback_performed": False,
        "alert_request_status": "not_needed",
        "alert_run_url": None,
        "alert_retry_request_id": None,
        "alert_retry_actor": None,
        "alert_retry_requested_at": None,
        "validations": [],
    }


def append_history(config: RunnerConfig, entry: dict[str, Any]) -> None:
    line = json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
    with config.history_path.open("a", encoding="utf-8") as history_file:
        os.chmod(config.history_path, 0o644)
        history_file.write(f"{line}\n")
        history_file.flush()
        os.fsync(history_file.fileno())
    lines = config.history_path.read_text(encoding="utf-8").splitlines()
    if len(lines) > MAX_HISTORY_LINES:
        atomic_write(
            config.history_path,
            "\n".join(lines[-MAX_HISTORY_LINES:]) + "\n",
            0o644,
        )


def append_alert_result(
    config: RunnerConfig,
    request_id: str,
    target_version: str,
    status: str,
    run_url: str | None,
    retry_request_id: str | None = None,
    retry_actor: str | None = None,
    retry_requested_at: str | None = None,
) -> None:
    if status not in {"requested", "request_failed"}:
        raise ValueError("지원하지 않는 호스트 알림 상태입니다")
    if status == "requested":
        if not isinstance(run_url, str) or not ALERT_RUN_URL_PATTERN.fullmatch(run_url):
            raise ValueError("호스트 알림 실행 URL이 올바르지 않습니다")
    elif run_url is not None:
        raise ValueError("실패한 호스트 알림에는 실행 URL을 저장할 수 없습니다")
    if (retry_actor is None) != (retry_requested_at is None):
        raise ValueError("알림 재시도 요청자와 요청 시각은 함께 저장해야 합니다")
    if retry_actor is not None and (
        not retry_actor
        or len(retry_actor) > 100
        or any(ord(character) < 32 for character in retry_actor)
    ):
        raise ValueError("알림 재시도 요청자가 올바르지 않습니다")
    if retry_requested_at is not None and parse_datetime(retry_requested_at) is None:
        raise ValueError("알림 재시도 요청 시각이 올바르지 않습니다")
    if retry_request_id is not None and (
        retry_actor is None
        or str(UUID(retry_request_id)) != retry_request_id
    ):
        raise ValueError("알림 재시도 요청 ID가 올바르지 않습니다")

    entry = _latest_history_entry(config, request_id)
    if entry.get("status") != "rollback_failed":
        raise ValueError("자동 롤백 실패 이력에만 알림 결과를 저장할 수 있습니다")
    if entry.get("target_version") != target_version:
        raise ValueError("알림 재시도 대상 버전이 원본 업데이트와 다릅니다")
    append_history(
        config,
        {
            **entry,
            "alert_request_status": status,
            "alert_run_url": run_url,
            "alert_retry_request_id": retry_request_id,
            "alert_retry_actor": retry_actor,
            "alert_retry_requested_at": retry_requested_at,
        },
    )


def validate_alert_retry(config: RunnerConfig, request_id: str, target_version: str) -> None:
    entry = _latest_history_entry(config, request_id)
    if (
        entry.get("status") != "rollback_failed"
        or entry.get("alert_request_status") != "request_failed"
        or entry.get("target_version") != target_version
    ):
        raise ValueError("재시도할 수 있는 자동 롤백 실패 알림이 아닙니다")


def _latest_history_entry(config: RunnerConfig, request_id: str) -> dict[str, Any]:
    for line in reversed(config.history_path.read_text(encoding="utf-8").splitlines()):
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(entry, dict) and entry.get("request_id") == request_id:
            return entry
    raise ValueError("호스트 알림을 연결할 업데이트 이력을 찾지 못했습니다")


def write_heartbeat(config: RunnerConfig, status: str, detail: str) -> None:
    payload = json.dumps(
        {"status": status, "checked_at": utc_now(), "message": detail[:300]},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    atomic_write(config.heartbeat_path, f"{payload}\n", 0o644)


def atomic_write(path: Path, content: str, mode: int) -> None:
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, mode)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            output.write(content)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
