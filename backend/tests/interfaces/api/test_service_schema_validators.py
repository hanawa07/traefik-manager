import pytest
from pydantic import ValidationError

from app.interfaces.api.v1.schemas.service_schemas import ServiceCreate, ServiceUpdate


def test_service_create_normalizes_shared_fields():
    request = ServiceCreate(
        name="svc",
        domain="svc.example.com",
        upstream_host="app",
        upstream_port=8080,
        allowed_ips=["192.168.1.1", "192.168.1.1/32", "10.0.0.1/24"],
        custom_headers={" X-Test ": " value "},
        healthcheck_path=" ",
        healthcheck_expected_statuses=[204, 200, 204],
        middleware_template_ids=[" template-a ", "", "template-a"],
    )

    assert request.allowed_ips == ["192.168.1.1/32", "10.0.0.0/24"]
    assert request.custom_headers == {"X-Test": "value"}
    assert request.healthcheck_path == "/"
    assert request.healthcheck_expected_statuses == [200, 204]
    assert request.middleware_template_ids == ["template-a"]


def test_service_update_normalizes_present_shared_fields():
    request = ServiceUpdate(
        allowed_ips=["192.168.1.1", "192.168.1.1/32"],
        custom_headers={" X-Trace ": " ok "},
        healthcheck_expected_statuses=[204, 200, 204],
        middleware_template_ids=[" template-a ", "", "template-a"],
    )

    assert request.allowed_ips == ["192.168.1.1/32"]
    assert request.custom_headers == {"X-Trace": "ok"}
    assert request.healthcheck_expected_statuses == [200, 204]
    assert request.middleware_template_ids == ["template-a"]


def test_service_create_rejects_invalid_shared_fields():
    with pytest.raises(ValidationError, match="헬스 체크 경로는 '/'로 시작해야 합니다"):
        ServiceCreate(
            name="svc",
            domain="svc.example.com",
            upstream_host="app",
            upstream_port=8080,
            healthcheck_path="healthz",
        )


def test_service_update_rejects_invalid_custom_headers():
    with pytest.raises(ValidationError, match="유효하지 않은 헤더 값입니다"):
        ServiceUpdate(custom_headers={"X-Test": "bad\nvalue"})
