#!/usr/bin/env python3
import fcntl
import json
import sys

from traefik_update_executor import process_request
from traefik_update_models import RunnerConfig, message
from traefik_update_storage import read_request, write_heartbeat


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

    write_heartbeat(
        config,
        "running",
        f"{request.target_version} 업데이트를 처리하는 중입니다",
    )
    try:
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
        write_heartbeat(config, "error", "업데이트와 자동 롤백에 실패했습니다")
        return 1
    write_heartbeat(config, "ready", f"마지막 업데이트 결과: {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
