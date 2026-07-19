from types import SimpleNamespace
from uuid import uuid4


class StubUseCases:
    def __init__(self, routing_mode="active"):
        self.routing_mode = routing_mode

    async def list_services(self):
        return [
            SimpleNamespace(
                id=SimpleNamespace(value=uuid4()),
                domain="svc.example.com",
                upstream_host="example.com",
                upstream_port=443,
                routing_mode=self.routing_mode,
                upstream_scheme="https",
                skip_tls_verify=True,
                healthcheck_enabled=False,
                healthcheck_path="/readyz",
                healthcheck_timeout_ms=1200,
                healthcheck_expected_statuses=[200, 204],
            )
        ]


class StubServiceCrudUseCases:
    def __init__(self, before_service=None, after_service=None):
        self.before_service = before_service
        self.after_service = after_service
        self.updated_payload = None
        self.rollback_service_id = None
        self.created_payload = None
        self.deleted_service_id = None

    async def get_service(self, service_id):
        if self.before_service and str(getattr(self.before_service, "id")) == str(service_id):
            return self.before_service
        if self.after_service and str(getattr(self.after_service, "id")) == str(service_id):
            return self.after_service
        return self.before_service

    async def create_service(self, data):
        self.created_payload = data.model_dump()
        return self.after_service

    async def update_service(self, service_id, data):
        self.rollback_service_id = service_id
        self.updated_payload = data.model_dump(exclude_unset=True)
        return self.after_service

    async def delete_service(self, service_id):
        self.deleted_service_id = service_id


class StubExecuteResult:
    def __init__(self, item):
        self._item = item

    def scalar_one_or_none(self):
        return self._item


class StubDB:
    def __init__(self, item):
        self.item = item

    async def execute(self, _query):
        return StubExecuteResult(self.item)


def make_service(**overrides):
    service_id = overrides.pop("id", uuid4())
    defaults = {
        "id": service_id,
        "name": "svc",
        "domain": "svc.example.com",
        "upstream_host": "app",
        "upstream_port": 8080,
        "routing_mode": "active",
        "upstream_scheme": "http",
        "skip_tls_verify": False,
        "tls_enabled": True,
        "https_redirect_enabled": True,
        "auth_mode": "none",
        "api_key": None,
        "allowed_ips": [],
        "blocked_paths": [],
        "middleware_template_ids": [],
        "rate_limit_average": None,
        "rate_limit_burst": None,
        "custom_headers": {},
        "frame_policy": "deny",
        "healthcheck_enabled": True,
        "healthcheck_path": "/",
        "healthcheck_timeout_ms": 3000,
        "healthcheck_expected_statuses": [],
        "basic_auth_users": [],
        "authentik_group_id": None,
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)
