from ipaddress import ip_network
import re

FRAME_POLICY_VALUES = {"deny", "sameorigin", "off"}
AUTH_MODE_VALUES = {"none", "authentik", "token"}
ROUTING_MODE_VALUES = {"active", "disabled", "maintenance"}
DEFAULT_HEALTHCHECK_PATH = "/"
DEFAULT_HEALTHCHECK_TIMEOUT_MS = 3000


def normalize_auth_mode(auth_mode: str, auth_enabled: bool | None = None) -> str:
    normalized = auth_mode
    if auth_enabled is not None and auth_mode == "none":
        normalized = "authentik" if auth_enabled else "none"
    if normalized not in AUTH_MODE_VALUES:
        raise ValueError("인증 모드는 none, authentik, token 중 하나여야 합니다")
    return normalized


def normalize_frame_policy(frame_policy: str) -> str:
    normalized = frame_policy.strip().lower()
    if normalized not in FRAME_POLICY_VALUES:
        raise ValueError("frame_policy는 deny, sameorigin, off 중 하나여야 합니다")
    return normalized


def normalize_routing_mode(routing_mode: str) -> str:
    normalized = routing_mode.strip().lower()
    if normalized not in ROUTING_MODE_VALUES:
        raise ValueError("라우팅 상태는 active, disabled, maintenance 중 하나여야 합니다")
    return normalized


def normalize_healthcheck_path(healthcheck_path: str) -> str:
    normalized = healthcheck_path.strip() or DEFAULT_HEALTHCHECK_PATH
    if not normalized.startswith("/"):
        raise ValueError("헬스 체크 경로는 '/'로 시작해야 합니다")
    return normalized


def normalize_healthcheck_timeout_ms(healthcheck_timeout_ms: int) -> int:
    if healthcheck_timeout_ms <= 0:
        raise ValueError("헬스 체크 타임아웃은 1ms 이상의 정수여야 합니다")
    return healthcheck_timeout_ms


def normalize_healthcheck_expected_statuses(
    healthcheck_expected_statuses: list[int] | None,
) -> list[int]:
    if not healthcheck_expected_statuses:
        return []

    normalized: list[int] = []
    seen: set[int] = set()
    for status in healthcheck_expected_statuses:
        if not (100 <= status <= 599):
            raise ValueError("헬스 체크 기대 상태 코드는 100~599 범위여야 합니다")
        if status not in seen:
            seen.add(status)
            normalized.append(status)
    return sorted(normalized)


def normalize_allowed_ips(allowed_ips: list[str] | None) -> list[str]:
    if not allowed_ips:
        return []

    normalized: list[str] = []
    seen: set[str] = set()

    for raw_ip in allowed_ips:
        value = raw_ip.strip()
        if not value:
            continue
        network = str(ip_network(value, strict=False))
        if network not in seen:
            seen.add(network)
            normalized.append(network)

    return normalized


def normalize_rate_limit(
    rate_limit_average: int | None,
    rate_limit_burst: int | None,
) -> tuple[int | None, int | None]:
    if rate_limit_average is None and rate_limit_burst is None:
        return None, None
    if rate_limit_average is None or rate_limit_burst is None:
        raise ValueError("Rate Limit을 활성화하려면 average와 burst를 모두 입력해야 합니다")
    if rate_limit_average <= 0 or rate_limit_burst <= 0:
        raise ValueError("Rate Limit 값은 1 이상의 정수여야 합니다")
    return rate_limit_average, rate_limit_burst


def normalize_custom_headers(custom_headers: dict[str, str] | None) -> dict[str, str]:
    if not custom_headers:
        return {}

    normalized: dict[str, str] = {}
    token_pattern = re.compile(r"^[A-Za-z0-9-]+$")

    for raw_key, raw_value in custom_headers.items():
        key = raw_key.strip()
        value = raw_value.strip()
        if not key:
            continue
        if not token_pattern.match(key):
            raise ValueError(f"유효하지 않은 헤더 키입니다: {key}")
        if "\n" in key or "\r" in key or "\n" in value or "\r" in value:
            raise ValueError(f"유효하지 않은 헤더 값입니다: {key}")
        normalized[key] = value

    return normalized


def normalize_basic_auth_users(basic_auth_users: list[str] | None) -> list[str]:
    if not basic_auth_users:
        return []

    normalized: list[str] = []
    seen: set[str] = set()

    for raw_user in basic_auth_users:
        value = raw_user.strip()
        if not value:
            continue
        if "\n" in value or "\r" in value:
            raise ValueError("유효하지 않은 Basic Auth 사용자 정보입니다")
        if ":" not in value:
            raise ValueError("Basic Auth 사용자 정보 형식이 올바르지 않습니다")
        username, hashed_password = value.split(":", 1)
        username = username.strip()
        hashed_password = hashed_password.strip()
        if not username or not hashed_password:
            raise ValueError("Basic Auth 사용자 정보 형식이 올바르지 않습니다")
        if ":" in username:
            raise ValueError("Basic Auth 사용자명에 ':' 문자를 사용할 수 없습니다")
        normalized_value = f"{username}:{hashed_password}"
        if normalized_value not in seen:
            seen.add(normalized_value)
            normalized.append(normalized_value)

    return normalized


def normalize_middleware_template_ids(template_ids: list[str] | None) -> list[str]:
    if not template_ids:
        return []

    normalized: list[str] = []
    seen: set[str] = set()
    for raw_id in template_ids:
        value = str(raw_id).strip()
        if not value:
            continue
        if value not in seen:
            seen.add(value)
            normalized.append(value)
    return normalized


def normalize_blocked_paths(paths: list[str] | None) -> list[str]:
    if not paths:
        return []

    normalized: list[str] = []
    seen: set[str] = set()
    for raw_path in paths:
        value = raw_path.strip()
        if not value:
            continue
        if not value.startswith("/"):
            value = "/" + value
        if value not in seen:
            seen.add(value)
            normalized.append(value)
    return normalized
