from ipaddress import ip_network
import re

AUTH_MODE_VALUES = {"none", "authentik", "token"}
FRAME_POLICY_VALUES = {"deny", "sameorigin", "off"}
DEFAULT_HEALTHCHECK_PATH = "/"
DEFAULT_HEALTHCHECK_TIMEOUT_MS = 3000
UPSTREAM_SCHEME_VALUES = {"http", "https"}


def validate_auth_mode(value: str) -> str:
    if value not in AUTH_MODE_VALUES:
        raise ValueError(f"auth_mode는 {AUTH_MODE_VALUES} 중 하나여야 합니다")
    return value


def validate_optional_auth_mode(value: str | None) -> str | None:
    if value is None:
        return None
    return validate_auth_mode(value)


def validate_upstream_scheme(value: str) -> str:
    if value not in UPSTREAM_SCHEME_VALUES:
        raise ValueError("업스트림 스킴은 http 또는 https여야 합니다")
    return value


def validate_optional_upstream_scheme(value: str | None) -> str | None:
    if value is None:
        return None
    return validate_upstream_scheme(value)


def validate_frame_policy(value: str) -> str:
    if value not in FRAME_POLICY_VALUES:
        raise ValueError(f"frame_policy는 {FRAME_POLICY_VALUES} 중 하나여야 합니다")
    return value


def validate_optional_frame_policy(value: str | None) -> str | None:
    if value is None:
        return None
    return validate_frame_policy(value)


def normalize_healthcheck_path(value: str) -> str:
    normalized = value.strip() or DEFAULT_HEALTHCHECK_PATH
    if not normalized.startswith("/"):
        raise ValueError("헬스 체크 경로는 '/'로 시작해야 합니다")
    return normalized


def normalize_optional_healthcheck_path(value: str | None) -> str | None:
    if value is None:
        return None
    return normalize_healthcheck_path(value)


def validate_healthcheck_timeout_ms(value: int) -> int:
    if value <= 0:
        raise ValueError("헬스 체크 타임아웃은 1ms 이상의 정수여야 합니다")
    return value


def validate_optional_healthcheck_timeout_ms(value: int | None) -> int | None:
    if value is None:
        return None
    return validate_healthcheck_timeout_ms(value)


def normalize_healthcheck_expected_statuses(values: list[int]) -> list[int]:
    normalized: list[int] = []
    seen: set[int] = set()
    for value in values:
        if not (100 <= value <= 599):
            raise ValueError("헬스 체크 기대 상태 코드는 100~599 범위여야 합니다")
        if value not in seen:
            seen.add(value)
            normalized.append(value)
    return sorted(normalized)


def normalize_optional_healthcheck_expected_statuses(
    values: list[int] | None,
) -> list[int] | None:
    if values is None:
        return None
    return normalize_healthcheck_expected_statuses(values)


def validate_domain(value: str) -> str:
    pattern = r"^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$"
    if not re.match(pattern, value):
        raise ValueError("유효하지 않은 도메인 형식입니다")
    return value


def validate_port(value: int) -> int:
    if not (1 <= value <= 65535):
        raise ValueError("포트는 1~65535 범위여야 합니다")
    return value


def normalize_allowed_ips(values: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw_ip in values:
        value = raw_ip.strip()
        if not value:
            continue
        cidr = str(ip_network(value, strict=False))
        if cidr not in seen:
            seen.add(cidr)
            normalized.append(cidr)
    return normalized


def normalize_optional_allowed_ips(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    return normalize_allowed_ips(values)


def validate_blocked_paths(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    for path in values:
        if not path.startswith("/"):
            raise ValueError(f"차단 경로는 '/'로 시작해야 합니다: {path}")
    return values


def normalize_authentik_group_id(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value or None


def normalize_middleware_template_ids(values: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for raw_id in values:
        value = str(raw_id).strip()
        if not value:
            continue
        if value not in seen:
            seen.add(value)
            normalized.append(value)
    return normalized


def normalize_optional_middleware_template_ids(values: list[str] | None) -> list[str] | None:
    if values is None:
        return None
    return normalize_middleware_template_ids(values)


def validate_rate_limit_value(value: int | None) -> int | None:
    if value is None:
        return None
    if value <= 0:
        raise ValueError("Rate Limit 값은 1 이상의 정수여야 합니다")
    return value


def normalize_custom_headers(values: dict[str, str]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    token_pattern = re.compile(r"^[A-Za-z0-9-]+$")

    for raw_key, raw_value in values.items():
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


def normalize_optional_custom_headers(
    values: dict[str, str] | None,
) -> dict[str, str] | None:
    if values is None:
        return None
    return normalize_custom_headers(values)
