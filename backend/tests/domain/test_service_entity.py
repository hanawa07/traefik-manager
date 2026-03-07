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
    # Case 1: create() with auth_enabled=False
    service = make_service(auth_enabled=False, authentik_group_id="some-group")
    assert service.authentik_group_id is None

    # Case 2: update() setting auth_enabled to False
    service = make_service(auth_enabled=True, authentik_group_id="some-group")
    assert service.authentik_group_id == "some-group"
    service.update(auth_enabled=False)
    assert service.authentik_group_id is None

def test_allowed_ips_cidr_normalization(make_service):
    service = make_service(allowed_ips=["192.168.1.1", "10.0.0.0/24"])
    assert "192.168.1.1/32" in service.allowed_ips
    assert "10.0.0.0/24" in service.allowed_ips
    assert len(service.allowed_ips) == 2
