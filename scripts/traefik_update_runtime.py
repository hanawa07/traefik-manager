import json
import subprocess
import time

from traefik_update_models import (
    VERSION_PATTERN,
    RunnerConfig,
    UpdateRejectedError,
    ValidationError,
    message,
    version_from_image,
)


def _run_compose(config: RunnerConfig, action: str, *arguments: str) -> None:
    _run(
        [
            *_compose_command(config),
            action,
            *arguments,
            config.service,
        ],
        timeout=600,
    )


def _compose_command(config: RunnerConfig) -> list[str]:
    command = [config.docker_bin, "compose"]
    for compose_file in config.compose_files:
        command.extend(["-f", str(compose_file)])
    return command


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
