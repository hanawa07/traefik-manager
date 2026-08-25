#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
import sys
from typing import Any
from uuid import UUID

from traefik_update_models import RunnerConfig, parse_datetime, utc_now
from traefik_update_runtime import _docker_inspect
from traefik_update_storage import atomic_write

CONTAINER_ID_PATTERN = re.compile(r"^[0-9a-f]{64}$")
MANAGED_SOURCES = {"patch_update", "rollback", "manual_safe"}
MAX_HISTORY_LINES = 200
MAX_STATE_BYTES = 4096


def current_container(config: RunnerConfig) -> dict[str, str]:
    raw = _docker_inspect(
        config,
        "{{.Id}}|{{.Created}}|{{.Config.Image}}",
    )
    values = raw.split("|", 2)
    if len(values) != 3:
        raise ValueError("Traefik 컨테이너 식별 정보를 확인할 수 없습니다")
    container_id, created_at, image = values
    if not CONTAINER_ID_PATTERN.fullmatch(container_id):
        raise ValueError("Traefik 컨테이너 ID가 올바르지 않습니다")
    if parse_datetime(created_at) is None:
        raise ValueError("Traefik 컨테이너 생성 시각이 올바르지 않습니다")
    if not _is_valid_image(image):
        raise ValueError("Traefik 컨테이너 이미지가 올바르지 않습니다")
    return {"container_id": container_id, "created_at": created_at, "image": image}


def safe_current_container_id(config: RunnerConfig) -> str | None:
    try:
        return current_container(config)["container_id"]
    except (OSError, RuntimeError, ValueError, subprocess.SubprocessError):
        return None


def observe_container_recreation(config: RunnerConfig) -> dict[str, Any] | None:
    current = current_container(config)
    previous = _read_state(config)
    if previous is None:
        _write_state(config, current)
        return None
    if previous["container_id"] == current["container_id"]:
        return None
    entry = _history_entry(
        current,
        previous["container_id"],
        status="unmanaged",
        source="direct_or_unknown",
    )
    _append_history(config, entry)
    _write_state(config, current)
    return entry


def record_managed_recreation(
    config: RunnerConfig,
    previous_container_id: str | None,
    source: str,
    *,
    request_id: str | None = None,
    actor: str | None = None,
) -> dict[str, Any] | None:
    if source not in MANAGED_SOURCES:
        raise ValueError("지원하지 않는 Traefik 재생성 출처입니다")
    if previous_container_id is not None and not CONTAINER_ID_PATTERN.fullmatch(
        previous_container_id
    ):
        raise ValueError("이전 Traefik 컨테이너 ID가 올바르지 않습니다")
    if request_id is not None and str(UUID(request_id)) != request_id:
        raise ValueError("Traefik 업데이트 요청 ID가 올바르지 않습니다")
    if actor is not None and (
        not actor or len(actor) > 100 or any(ord(character) < 32 for character in actor)
    ):
        raise ValueError("Traefik 재생성 요청자가 올바르지 않습니다")

    current = current_container(config)
    previous = previous_container_id or (_read_state(config) or {}).get("container_id")
    if previous == current["container_id"]:
        _write_state(config, current)
        return None
    entry = _history_entry(
        current,
        previous,
        status="managed",
        source=source,
        request_id=request_id,
        actor=actor,
    )
    _append_history(config, entry)
    _write_state(config, current)
    return entry


def _history_entry(
    current: dict[str, str],
    previous_container_id: str | None,
    *,
    status: str,
    source: str,
    request_id: str | None = None,
    actor: str | None = None,
) -> dict[str, Any]:
    return {
        "schema_version": 1,
        **current,
        "previous_container_id": previous_container_id,
        "status": status,
        "source": source,
        "request_id": request_id,
        "actor": actor,
        "observed_at": utc_now(),
    }


def _read_state(config: RunnerConfig) -> dict[str, str] | None:
    path = config.recreate_state_path
    if not path.exists():
        return None
    stat = path.lstat()
    if path.is_symlink() or not path.is_file() or stat.st_size > MAX_STATE_BYTES:
        raise ValueError("Traefik 재생성 기준 상태 파일이 올바르지 않습니다")
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise ValueError("Traefik 재생성 기준 상태가 올바르지 않습니다")
    container_id = raw.get("container_id")
    created_at = raw.get("created_at")
    image = raw.get("image")
    if (
        not isinstance(container_id, str)
        or not CONTAINER_ID_PATTERN.fullmatch(container_id)
        or not isinstance(created_at, str)
        or parse_datetime(created_at) is None
        or not _is_valid_image(image)
    ):
        raise ValueError("Traefik 재생성 기준 상태가 올바르지 않습니다")
    return {"container_id": container_id, "created_at": created_at, "image": image}


def _is_valid_image(value: object) -> bool:
    return (
        isinstance(value, str)
        and bool(value)
        and len(value) <= 200
        and not any(ord(character) < 32 for character in value)
    )


def _write_state(config: RunnerConfig, snapshot: dict[str, str]) -> None:
    atomic_write(
        config.recreate_state_path,
        json.dumps(snapshot, ensure_ascii=False, separators=(",", ":")) + "\n",
        0o600,
    )


def _append_history(config: RunnerConfig, entry: dict[str, Any]) -> None:
    line = json.dumps(entry, ensure_ascii=False, separators=(",", ":"))
    with config.recreate_history_path.open("a", encoding="utf-8") as history_file:
        os.chmod(config.recreate_history_path, 0o644)
        history_file.write(f"{line}\n")
        history_file.flush()
        os.fsync(history_file.fileno())
    lines = config.recreate_history_path.read_text(encoding="utf-8").splitlines()
    if len(lines) > MAX_HISTORY_LINES:
        atomic_write(
            config.recreate_history_path,
            "\n".join(lines[-MAX_HISTORY_LINES:]) + "\n",
            0o644,
        )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("previous_container_id")
    parser.add_argument("source", choices=sorted(MANAGED_SOURCES))
    parser.add_argument("--request-id")
    parser.add_argument("--actor")
    arguments = parser.parse_args()
    try:
        config = RunnerConfig.from_environment()
        entry = record_managed_recreation(
            config,
            arguments.previous_container_id,
            arguments.source,
            request_id=arguments.request_id,
            actor=arguments.actor,
        )
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as exc:
        print(f"Traefik 재생성 이력 기록 실패: {exc}", file=sys.stderr)
        return 1
    print("recorded" if entry else "unchanged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
