import pytest
import yaml
from pathlib import Path
from unittest.mock import MagicMock

from app.domain.proxy.entities.middleware_template import MiddlewareTemplate
from app.domain.proxy.entities.service import Service
from app.infrastructure.traefik.file_provider_writer import FileProviderWriter


@pytest.fixture
def writer(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "app.infrastructure.traefik.file_provider_writer.settings",
        MagicMock(TRAEFIK_CONFIG_PATH=str(tmp_path)),
    )
    return FileProviderWriter()


def test_write_authentik_middleware_creates_file(writer, tmp_path):
    writer.write_authentik_middleware()

    file_path = tmp_path / FileProviderWriter.AUTHENTIK_MIDDLEWARE_FILE
    assert file_path.exists()

    content = file_path.read_text()
    assert "forwardAuth" in content
    assert "authentik-server:9000" in content
    assert "authentik" in content


def test_write_authentik_middleware_is_idempotent(writer, tmp_path):
    writer.write_authentik_middleware()
    writer.write_authentik_middleware()

    file_path = tmp_path / FileProviderWriter.AUTHENTIK_MIDDLEWARE_FILE
    assert file_path.exists()


def test_write_keeps_existing_file_when_atomic_write_fails(writer, tmp_path, monkeypatch):
    file_path = tmp_path / FileProviderWriter.AUTHENTIK_MIDDLEWARE_FILE
    file_path.write_text("old: true\n", encoding="utf-8")

    def fail_fsync(_fd):
        raise RuntimeError("disk sync failed")

    monkeypatch.setattr("app.infrastructure.traefik.file_provider_writer.os.fsync", fail_fsync)

    with pytest.raises(RuntimeError, match="disk sync failed"):
        writer.write_authentik_middleware()

    assert file_path.read_text(encoding="utf-8") == "old: true\n"
    assert list(tmp_path.glob("*.tmp")) == []
    assert list(tmp_path.glob(".*.tmp")) == []


def test_delete_authentik_middleware_if_unused_deletes_when_zero(writer, tmp_path):
    writer.write_authentik_middleware()
    file_path = tmp_path / FileProviderWriter.AUTHENTIK_MIDDLEWARE_FILE
    assert file_path.exists()

    writer.delete_authentik_middleware_if_unused(remaining_auth_service_count=0)

    assert not file_path.exists()


def test_delete_authentik_middleware_if_unused_keeps_when_remaining(writer, tmp_path):
    writer.write_authentik_middleware()
    file_path = tmp_path / FileProviderWriter.AUTHENTIK_MIDDLEWARE_FILE

    writer.delete_authentik_middleware_if_unused(remaining_auth_service_count=2)

    assert file_path.exists()


def test_delete_authentik_middleware_if_unused_no_error_when_file_missing(writer):
    # 파일이 없어도 에러 없이 처리해야 한다
    writer.delete_authentik_middleware_if_unused(remaining_auth_service_count=0)


def test_write_traefik_dashboard_public_config_creates_file(writer, tmp_path):
    writer.write_traefik_dashboard_public_route(
        domain="traefik-debug.example.com",
        basic_auth_username="debug-admin",
        basic_auth_password_hash="$2b$12$abcdefghijklmnopqrstuuE7J8V4ZZ4Jm1t6k8JmH6O4lzM2K0m",
    )

    file_path = tmp_path / FileProviderWriter.TRAEFIK_DASHBOARD_PUBLIC_FILE
    assert file_path.exists()

    content = file_path.read_text()
    assert "Host(`traefik-debug.example.com`)" in content
    assert "api@internal" in content
    assert "debug-admin:$2b$12$abcdefghijklmnopqrstuuE7J8V4ZZ4Jm1t6k8JmH6O4lzM2K0m" in content
    assert "certResolver: letsencrypt" in content


def test_delete_traefik_dashboard_public_route_removes_file(writer, tmp_path):
    writer.write_traefik_dashboard_public_route(
        domain="traefik-debug.example.com",
        basic_auth_username="debug-admin",
        basic_auth_password_hash="$2b$12$abcdefghijklmnopqrstuuE7J8V4ZZ4Jm1t6k8JmH6O4lzM2K0m",
    )
    file_path = tmp_path / FileProviderWriter.TRAEFIK_DASHBOARD_PUBLIC_FILE
    assert file_path.exists()

    writer.delete_traefik_dashboard_public_route()

    assert not file_path.exists()


def test_write_service_references_shared_template_without_redefining_it(writer, tmp_path):
    template = MiddlewareTemplate.create(
        name="DDoS 방어",
        type="rateLimit",
        config={"average": 100, "burst": 200},
    )
    service = Service.create(
        name="app",
        domain="app.example.com",
        upstream_host="app",
        upstream_port=3000,
        tls_enabled=False,
        https_redirect_enabled=False,
        middleware_template_ids=[str(template.id)],
    )

    writer.write_shared_middleware_templates([template])
    writer.write(service, middleware_templates=[template])

    service_config = yaml.safe_load((tmp_path / "app-example-com.yml").read_text())
    shared_config = yaml.safe_load((tmp_path / FileProviderWriter.SHARED_MIDDLEWARE_TEMPLATES_FILE).read_text())
    router = service_config["http"]["routers"]["app-example-com"]

    assert template.shared_name not in service_config["http"].get("middlewares", {})
    assert f"{template.shared_name}@file" in router["middlewares"]
    assert shared_config["http"]["middlewares"][template.shared_name] == {
        "rateLimit": {"average": 100, "burst": 200}
    }


def test_write_disabled_service_removes_existing_route_file(writer, tmp_path, make_service):
    service = make_service(domain="paused.example.com")
    writer.write(service)
    file_path = tmp_path / "paused-example-com.yml"
    assert file_path.exists()

    service.update(routing_mode="disabled")
    writer.write(service)

    assert not file_path.exists()
