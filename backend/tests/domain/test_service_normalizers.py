import pytest

from app.domain.proxy.entities.service_normalizers import (
    normalize_allowed_ips,
    normalize_basic_auth_users,
    normalize_blocked_paths,
    normalize_custom_headers,
    normalize_healthcheck_expected_statuses,
)


def test_normalize_allowed_ips_canonicalizes_and_deduplicates():
    assert normalize_allowed_ips(["192.168.1.1", "192.168.1.1/32", "10.0.0.1/24"]) == [
        "192.168.1.1/32",
        "10.0.0.0/24",
    ]


def test_normalize_blocked_paths_prefixes_slashes_and_deduplicates():
    assert normalize_blocked_paths(["admin", "/admin", " api "]) == ["/admin", "/api"]


def test_normalize_custom_headers_trims_and_rejects_invalid_values():
    assert normalize_custom_headers({" X-Test ": " value "}) == {"X-Test": "value"}

    with pytest.raises(ValueError, match="유효하지 않은 헤더 값입니다"):
        normalize_custom_headers({"X-Test": "bad\nvalue"})


def test_normalize_basic_auth_users_trims_and_rejects_invalid_format():
    assert normalize_basic_auth_users([" alice : $2hash ", "alice:$2hash"]) == ["alice:$2hash"]

    with pytest.raises(ValueError, match="Basic Auth 사용자 정보 형식이 올바르지 않습니다"):
        normalize_basic_auth_users(["alice"])


def test_normalize_healthcheck_expected_statuses_sorts_and_validates_range():
    assert normalize_healthcheck_expected_statuses([204, 200, 204]) == [200, 204]

    with pytest.raises(ValueError, match="헬스 체크 기대 상태 코드는 100~599 범위여야 합니다"):
        normalize_healthcheck_expected_statuses([99])
