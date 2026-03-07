import os
import pytest
from datetime import datetime
from uuid import uuid4

# Set dummy environment variables for Pydantic Settings
os.environ["APP_SECRET_KEY"] = "test-secret-key"
os.environ["AUTHENTIK_URL"] = "http://authentik.test"
os.environ["AUTHENTIK_TOKEN"] = "test-token"
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key"
os.environ["ADMIN_PASSWORD"] = "test-admin-password"

from app.domain.proxy.entities.service import Service
from app.domain.proxy.value_objects.service_id import ServiceId
from app.domain.proxy.value_objects.domain_name import DomainName
from app.domain.proxy.value_objects.upstream import Upstream

@pytest.fixture
def make_service():
    def _make_service(
        name="test-service",
        domain="test.example.com",
        upstream_host="10.0.0.1",
        upstream_port=8080,
        tls_enabled=True,
        auth_enabled=False,
        https_redirect_enabled=True,
        allowed_ips=None,
        rate_limit_average=None,
        rate_limit_burst=None,
        custom_headers=None,
        basic_auth_users=None,
        middleware_template_ids=None,
        authentik_group_id=None,
    ):
        return Service.create(
            name=name,
            domain=domain,
            upstream_host=upstream_host,
            upstream_port=upstream_port,
            tls_enabled=tls_enabled,
            auth_enabled=auth_enabled,
            https_redirect_enabled=https_redirect_enabled,
            allowed_ips=allowed_ips,
            rate_limit_average=rate_limit_average,
            rate_limit_burst=rate_limit_burst,
            custom_headers=custom_headers,
            basic_auth_users=basic_auth_users,
            middleware_template_ids=middleware_template_ids,
            authentik_group_id=authentik_group_id,
        )
    return _make_service
