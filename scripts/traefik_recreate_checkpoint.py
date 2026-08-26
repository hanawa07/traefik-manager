import hashlib
import json
import os
import re
import shutil
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from traefik_update_models import RunnerConfig, VERSION_PATTERN, utc_now, version_from_image
from traefik_update_runtime import _compose_command, _docker_inspect, _run
from traefik_update_storage import atomic_write

CHECKPOINT_SCHEMA_VERSION = 1
MAX_CHECKPOINT_BYTES = 16 * 1024
MAX_COMPOSE_BYTES = 1024 * 1024
CONFIG_HASH_PATTERN = re.compile(r"^[0-9a-f]{64}$")


def ensure_runtime_checkpoint(config: RunnerConfig, expected_version: str) -> dict[str, Any]:
    checkpoint = load_runtime_checkpoint(config)
    running_hash = current_container_config_hash(config)
    if checkpoint is not None and checkpoint["config_hash"] == running_hash:
        if checkpoint["version"] != expected_version:
            raise ValueError("마지막 정상 체크포인트의 Traefik 버전이 현재 실행 버전과 다릅니다")
        return checkpoint

    if compose_config_hash(config) != running_hash:
        raise ValueError(
            "현재 Compose가 실행 중인 Traefik과 달라 마지막 정상 체크포인트를 만들 수 없습니다"
        )
    save_runtime_checkpoint(config, expected_version)
    checkpoint = load_runtime_checkpoint(config)
    if checkpoint is None:
        raise RuntimeError("마지막 정상 체크포인트를 확인할 수 없습니다")
    return checkpoint


def save_runtime_checkpoint(config: RunnerConfig, expected_version: str) -> None:
    running_hash = current_container_config_hash(config)
    if compose_config_hash(config) != running_hash:
        raise ValueError("실행 중인 Traefik과 다른 Compose는 정상 체크포인트로 저장할 수 없습니다")
    image = _docker_inspect(config, "{{.Config.Image}}")
    if version_from_image(image) != expected_version:
        raise ValueError("체크포인트 대상 Traefik 버전이 현재 컨테이너와 다릅니다")

    root = _checkpoint_root(config)
    _ensure_directory(root)
    checkpoint_id = str(uuid4())
    checkpoint_dir = root / checkpoint_id
    checkpoint_dir.mkdir(mode=0o700)
    files: list[dict[str, Any]] = []
    try:
        for compose_file in config.compose_files:
            relative = _relative_compose_path(config, compose_file)
            content, mode = _read_compose_file(compose_file)
            destination = checkpoint_dir / "compose" / relative
            destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            destination.write_bytes(content)
            os.chmod(destination, mode)
            files.append(
                {
                    "path": relative.as_posix(),
                    "sha256": hashlib.sha256(content).hexdigest(),
                    "mode": mode,
                }
            )
        manifest = {
            "schema_version": CHECKPOINT_SCHEMA_VERSION,
            "checkpoint_id": checkpoint_id,
            "config_hash": running_hash,
            "image": image,
            "version": expected_version,
            "saved_at": utc_now(),
            "files": files,
        }
        atomic_write(
            _checkpoint_manifest_path(config),
            json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n",
            0o644,
        )
    except Exception:
        shutil.rmtree(checkpoint_dir, ignore_errors=True)
        raise
    _prune_old_checkpoints(root, checkpoint_id)


def load_runtime_checkpoint(config: RunnerConfig) -> dict[str, Any] | None:
    manifest_path = _checkpoint_manifest_path(config)
    if not manifest_path.exists():
        return None
    stat = manifest_path.lstat()
    if (
        manifest_path.is_symlink()
        or not manifest_path.is_file()
        or stat.st_size > MAX_CHECKPOINT_BYTES
    ):
        raise ValueError("Traefik 정상 체크포인트 파일이 올바르지 않습니다")
    raw = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or raw.get("schema_version") != CHECKPOINT_SCHEMA_VERSION:
        raise ValueError("지원하지 않는 Traefik 정상 체크포인트입니다")

    checkpoint_id = raw.get("checkpoint_id")
    config_hash = raw.get("config_hash")
    version = raw.get("version")
    image = raw.get("image")
    if (
        not isinstance(checkpoint_id, str)
        or str(UUID(checkpoint_id)) != checkpoint_id
        or not isinstance(config_hash, str)
        or not CONFIG_HASH_PATTERN.fullmatch(config_hash)
        or not isinstance(version, str)
        or not VERSION_PATTERN.fullmatch(version)
        or not isinstance(image, str)
        or version_from_image(image) != version
    ):
        raise ValueError("Traefik 정상 체크포인트 식별 정보가 올바르지 않습니다")

    expected_paths = [
        _relative_compose_path(config, path).as_posix() for path in config.compose_files
    ]
    entries = raw.get("files")
    if (
        not isinstance(entries, list)
        or not all(isinstance(entry, dict) for entry in entries)
        or [entry.get("path") for entry in entries] != expected_paths
    ):
        raise ValueError("Traefik 정상 체크포인트의 Compose 파일 목록이 올바르지 않습니다")
    checkpoint_dir = _checkpoint_root(config) / checkpoint_id / "compose"
    for entry in entries:
        _validate_checkpoint_file(checkpoint_dir, entry)
    return raw


def restore_runtime_checkpoint(config: RunnerConfig, checkpoint: dict[str, Any]) -> None:
    checkpoint_dir = _checkpoint_root(config) / str(checkpoint["checkpoint_id"]) / "compose"
    for compose_file, entry in zip(config.compose_files, checkpoint["files"], strict=True):
        backup = checkpoint_dir / str(entry["path"])
        atomic_write(compose_file, backup.read_text(encoding="utf-8"), int(entry["mode"]))
    if compose_config_hash(config) != checkpoint["config_hash"]:
        raise RuntimeError("복원한 Compose가 마지막 정상 체크포인트와 일치하지 않습니다")


def current_container_config_hash(config: RunnerConfig) -> str:
    value = _docker_inspect(
        config,
        '{{ index .Config.Labels "com.docker.compose.config-hash" }}',
    )
    if not CONFIG_HASH_PATTERN.fullmatch(value):
        raise ValueError("실행 중인 Traefik의 Compose 구성 해시를 확인할 수 없습니다")
    return value


def compose_config_hash(config: RunnerConfig) -> str:
    output = _run([*_compose_command(config), "config", "--hash", config.service])
    values = output.split()
    if (
        len(values) != 2
        or values[0] != config.service
        or not CONFIG_HASH_PATTERN.fullmatch(values[1])
    ):
        raise ValueError("현재 Traefik Compose 구성 해시를 확인할 수 없습니다")
    return values[1]


def _checkpoint_manifest_path(config: RunnerConfig) -> Path:
    return config.state_dir / "traefik-safe-recreate-checkpoint.json"


def _checkpoint_root(config: RunnerConfig) -> Path:
    return config.state_dir / "traefik-safe-recreate-checkpoints"


def _relative_compose_path(config: RunnerConfig, path: Path) -> Path:
    try:
        relative = path.relative_to(config.compose_dir)
    except ValueError as exc:
        raise ValueError("Compose 파일은 Traefik 디렉터리 내부에 있어야 합니다") from exc
    if not relative.parts or ".." in relative.parts:
        raise ValueError("Compose 파일 경로가 올바르지 않습니다")
    return relative


def _read_compose_file(path: Path) -> tuple[bytes, int]:
    stat = path.lstat()
    if path.is_symlink() or not path.is_file() or stat.st_size > MAX_COMPOSE_BYTES:
        raise ValueError("체크포인트 대상 Compose 파일이 올바르지 않습니다")
    return path.read_bytes(), stat.st_mode & 0o777


def _validate_checkpoint_file(checkpoint_dir: Path, entry: dict[str, Any]) -> None:
    path = entry.get("path")
    digest = entry.get("sha256")
    mode = entry.get("mode")
    if (
        not isinstance(path, str)
        or Path(path).is_absolute()
        or ".." in Path(path).parts
        or not isinstance(digest, str)
        or not CONFIG_HASH_PATTERN.fullmatch(digest)
        or not isinstance(mode, int)
        or not 0 <= mode <= 0o777
    ):
        raise ValueError("Traefik 정상 체크포인트의 Compose 메타데이터가 올바르지 않습니다")
    backup = checkpoint_dir / path
    content, actual_mode = _read_compose_file(backup)
    if hashlib.sha256(content).hexdigest() != digest or actual_mode != mode:
        raise ValueError("Traefik 정상 체크포인트의 Compose 파일이 변경되었습니다")


def _ensure_directory(path: Path) -> None:
    path.mkdir(mode=0o700, parents=True, exist_ok=True)
    if path.is_symlink() or not path.is_dir():
        raise ValueError("Traefik 정상 체크포인트 디렉터리가 올바르지 않습니다")
    os.chmod(path, 0o700)


def _prune_old_checkpoints(root: Path, current_id: str) -> None:
    for child in root.iterdir():
        if child.name != current_id and child.is_dir() and not child.is_symlink():
            shutil.rmtree(child, ignore_errors=True)
