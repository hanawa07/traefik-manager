import pytest
from app.domain.proxy.entities.service import Service

def test_service_create_success(make_service):
    service = make_service(name="success-service", domain="success.com")
    assert service.name == "success-service"
    assert str(service.domain) == "success.com"
    assert service.upstream_host == "10.0.0.1"
    assert service.upstream_port == 8080

def test_https_redirect_requires_tls_on_create():
    with pytest.raises(ValueError, match="HTTPS 리다이렉트는 TLS 활성화 시에만 사용할 수 있습니다"):
        Service.create(
            name="fail",
            domain="fail.com",
            upstream_host="10.0.0.1",
            upstream_port=80,
            tls_enabled=False,
            https_redirect_enabled=True,
        )

def test_rate_limit_requires_both_average_and_burst():
    with pytest.raises(ValueError, match="Rate Limit을 활성화하려면 average와 burst를 모두 입력해야 합니다"):
        Service.create(
            name="fail",
            domain="fail.com",
            upstream_host="10.0.0.1",
            upstream_port=80,
            rate_limit_average=10,
            rate_limit_burst=None,
        )

def test_auth_disabled_forces_authentik_group_id_none(make_service):
    # Case 1: create() with auth_mode='none'
    service = make_service(auth_mode='none', authentik_group_id="some-group")
    assert service.authentik_group_id is None

    # Case 2: update() setting auth_mode to 'none'
    service = make_service(auth_mode='authentik', authentik_group_id="some-group")
    assert service.authentik_group_id == "some-group"
    service.update(auth_mode='none')
    assert service.authentik_group_id is None

def test_allowed_ips_cidr_normalization(make_service):
    service = make_service(allowed_ips=["192.168.1.1", "10.0.0.0/24"])
    assert "192.168.1.1/32" in service.allowed_ips
    assert "10.0.0.0/24" in service.allowed_ips
    assert len(service.allowed_ips) == 2


def test_healthcheck_defaults_are_applied(make_service):
    service = make_service()

    assert service.healthcheck_enabled is True
    assert service.healthcheck_path == "/"
    assert service.healthcheck_timeout_ms == 3000
    assert service.healthcheck_expected_statuses == []


def test_healthcheck_path_must_start_with_slash():
    with pytest.raises(ValueError, match="헬스 체크 경로는 '/'로 시작해야 합니다"):
        Service.create(
            name="healthcheck-path-fail",
            domain="healthcheck-fail.com",
            upstream_host="10.0.0.1",
            upstream_port=80,
            healthcheck_path="health",
        )


def test_healthcheck_update_normalizes_and_stores_policy(make_service):
    service = make_service()

    service.update(
        healthcheck_enabled=False,
        healthcheck_path="/status",
        healthcheck_timeout_ms=1500,
        healthcheck_expected_statuses=[204, 200, 204],
    )

    assert service.healthcheck_enabled is False
    assert service.healthcheck_path == "/status"
    assert service.healthcheck_timeout_ms == 1500
    assert service.healthcheck_expected_statuses == [200, 204]
