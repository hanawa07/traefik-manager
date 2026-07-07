from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.interfaces.api.v1.routers.services_gateway_diagnostics import (
    SERVICE_DOCKER_NETWORK_CONNECT_EVENT,
    SERVICE_GATEWAY_DIAGNOSIS_EVENT,
    connect_service_gateway_network_action,
    diagnose_service_gateway_action,
    record_service_gateway_diagnosis_action,
)


@pytest.mark.asyncio
async def test_diagnose_service_gateway_reports_ok_for_active_router_upstream_and_shared_network():
    service_id = uuid4()
    service = _make_service(service_id=service_id, upstream_host="english-app-1")

    result = await diagnose_service_gateway_action(
        service_id=service_id,
        use_cases=_UseCases(service),
        upstream_checker=_UpstreamChecker(status="up"),
        traefik_client=_TraefikClient(active=True),
        docker_client=_DockerClient(
            containers=[
                {"name": "traefik", "networks": ["proxy_net"]},
                {"name": "english-app-1", "networks": ["proxy_net", "default"]},
            ]
        ),
    )

    assert result.status == "ok"
    assert {check.key: check.status for check in result.checks} == {
        "traefik_router": "ok",
        "upstream_http": "ok",
        "docker_network": "ok",
    }


@pytest.mark.asyncio
async def test_diagnose_service_gateway_flags_missing_shared_network():
    service_id = uuid4()
    service = _make_service(service_id=service_id, upstream_host="english-app-1")

    result = await diagnose_service_gateway_action(
        service_id=service_id,
        use_cases=_UseCases(service),
        upstream_checker=_UpstreamChecker(status="up"),
        traefik_client=_TraefikClient(active=True),
        docker_client=_DockerClient(
            containers=[
                {"name": "traefik", "networks": ["proxy_net"]},
                {"name": "english-app-1", "networks": ["default"]},
            ]
        ),
    )

    checks = {check.key: check for check in result.checks}
    assert result.status == "fail"
    assert checks["docker_network"].status == "fail"
    assert "같은 Docker 네트워크" in checks["docker_network"].message
    assert checks["docker_network"].details["target_network"] == "proxy_net"


@pytest.mark.asyncio
async def test_diagnose_service_gateway_flags_missing_router_and_down_upstream():
    service_id = uuid4()
    service = _make_service(service_id=service_id)

    result = await diagnose_service_gateway_action(
        service_id=service_id,
        use_cases=_UseCases(service),
        upstream_checker=_UpstreamChecker(status="down", error="Connection refused"),
        traefik_client=_TraefikClient(active=False, include_domain=False),
        docker_client=_DockerClient(containers=[]),
    )

    checks = {check.key: check for check in result.checks}
    assert result.status == "fail"
    assert checks["traefik_router"].status == "fail"
    assert checks["upstream_http"].status == "fail"


@pytest.mark.asyncio
async def test_record_service_gateway_diagnosis_persists_audit_event():
    service_id = uuid4()
    service = _make_service(service_id=service_id, upstream_host="english-app-1")
    audit = _AuditService()

    result = await record_service_gateway_diagnosis_action(
        service_id=service_id,
        use_cases=_UseCases(service),
        upstream_checker=_UpstreamChecker(status="up"),
        traefik_client=_TraefikClient(active=True),
        docker_client=_DockerClient(
            containers=[
                {"name": "traefik", "networks": ["proxy_net"]},
                {"name": "english-app-1", "networks": ["proxy_net"]},
            ]
        ),
        db=object(),
        current_user={"username": "admin"},
        audit_service=audit,
    )

    assert result.status == "ok"
    assert audit.records[0]["action"] == "test"
    assert audit.records[0]["resource_type"] == "service"
    assert audit.records[0]["detail"]["event"] == SERVICE_GATEWAY_DIAGNOSIS_EVENT
    assert audit.records[0]["detail"]["status"] == "ok"
    assert audit.records[0]["detail"]["checks"][0]["key"] == "traefik_router"


@pytest.mark.asyncio
async def test_connect_service_gateway_network_connects_upstream_to_proxy_network():
    service_id = uuid4()
    service = _make_service(service_id=service_id, upstream_host="english-app-1")
    docker_client = _DockerClient(
        containers=[
            {"name": "traefik", "networks": ["proxy_net"]},
            {"name": "english-app-1", "networks": ["default"]},
        ]
    )
    audit = _AuditService()

    result = await connect_service_gateway_network_action(
        service_id=service_id,
        use_cases=_UseCases(service),
        docker_client=docker_client,
        db=object(),
        current_user={"username": "admin"},
        audit_service=audit,
    )

    assert result.status == "connected"
    assert result.network == "proxy_net"
    assert result.upstream_networks == ["default", "proxy_net"]
    assert docker_client.connect_calls == [("english-app-1", "proxy_net")]
    assert audit.records[0]["detail"]["event"] == SERVICE_DOCKER_NETWORK_CONNECT_EVENT


@pytest.mark.asyncio
async def test_connect_service_gateway_network_skips_when_already_connected():
    service_id = uuid4()
    service = _make_service(service_id=service_id, upstream_host="english-app-1")
    docker_client = _DockerClient(
        containers=[
            {"name": "traefik", "networks": ["proxy_net"]},
            {"name": "english-app-1", "networks": ["proxy_net"]},
        ]
    )

    result = await connect_service_gateway_network_action(
        service_id=service_id,
        use_cases=_UseCases(service),
        docker_client=docker_client,
        db=object(),
        current_user={"username": "admin"},
        audit_service=_AuditService(),
    )

    assert result.status == "already_connected"
    assert docker_client.connect_calls == []


@pytest.mark.asyncio
async def test_connect_service_gateway_network_rejects_non_container_upstream():
    service_id = uuid4()
    service = _make_service(service_id=service_id, upstream_host="api.example.com")

    with pytest.raises(HTTPException) as exc_info:
        await connect_service_gateway_network_action(
            service_id=service_id,
            use_cases=_UseCases(service),
            docker_client=_DockerClient(containers=[]),
            db=object(),
            current_user={"username": "admin"},
            audit_service=_AuditService(),
        )

    assert exc_info.value.status_code == 400


def _make_service(service_id, upstream_host="app"):
    return SimpleNamespace(
        id=SimpleNamespace(value=service_id),
        name="English",
        domain="english.lizstudio.co.kr",
        upstream_host=upstream_host,
        upstream_port=3000,
        upstream_scheme="http",
        skip_tls_verify=False,
        healthcheck_enabled=True,
        healthcheck_path="/",
        healthcheck_timeout_ms=3000,
        healthcheck_expected_statuses=[],
    )


class _UseCases:
    def __init__(self, service):
        self.service = service

    async def get_service(self, service_id):
        return self.service


class _UpstreamChecker:
    def __init__(self, *, status, error=None):
        self.status = status
        self.error = error

    async def check_upstream(self, *args):
        return {
            "status": self.status,
            "status_code": 200 if self.status == "up" else None,
            "latency_ms": 12 if self.status == "up" else None,
            "error": self.error,
            "error_kind": "connection_refused" if self.error else None,
            "checked_url": "http://app:3000/",
            "checked_at": "2026-07-04T00:00:00+00:00",
        }


class _TraefikClient:
    def __init__(self, *, active, include_domain=True):
        self.active = active
        self.include_domain = include_domain

    async def get_router_status(self):
        if not self.include_domain:
            return {"connected": True, "message": "ok", "domains": {}}
        return {
            "connected": True,
            "message": "ok",
            "domains": {
                "english.lizstudio.co.kr": {
                    "active": self.active,
                    "routers": [
                        {
                            "name": "english@file",
                            "status": "enabled" if self.active else "disabled",
                            "rule": "Host(`english.lizstudio.co.kr`)",
                        }
                    ],
                }
            },
        }


class _DockerClient:
    enabled = True

    def __init__(self, *, containers):
        self.containers = containers
        self.connect_calls = []

    async def list_container_candidates(self):
        return {
            "enabled": True,
            "socket_path": "/var/run/docker.sock",
            "message": "ok",
            "containers": self.containers,
        }

    async def connect_container_to_network(self, *, container_name, network_name):
        self.connect_calls.append((container_name, network_name))
        for container in self.containers:
            if container["name"] == container_name:
                networks = set(container.get("networks") or [])
                networks.add(network_name)
                container["networks"] = sorted(networks)
                return {"changed": True, "networks": container["networks"]}
        return {"changed": False, "networks": []}


class _AuditService:
    def __init__(self):
        self.records = []

    async def record(self, **kwargs):
        self.records.append(kwargs)
