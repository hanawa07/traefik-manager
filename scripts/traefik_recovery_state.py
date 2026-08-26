import json

from traefik_update_models import RunnerConfig, utc_now
from traefik_update_storage import atomic_write

RECOVERY_RESULTS = {"rolled_back", "rollback_failed"}
RECOVERY_SOURCES = {"patch_update", "manual_safe"}


def write_recovery_result(config: RunnerConfig, result: str, source: str) -> None:
    if result not in RECOVERY_RESULTS:
        raise ValueError("지원하지 않는 Traefik 자동 복구 결과입니다")
    if source not in RECOVERY_SOURCES:
        raise ValueError("지원하지 않는 Traefik 자동 복구 경로입니다")
    payload = {
        "schema_version": 1,
        "status": result,
        "source": source,
        "occurred_at": utc_now(),
    }
    atomic_write(
        config.state_dir / "traefik-recovery.json",
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n",
        0o644,
    )
