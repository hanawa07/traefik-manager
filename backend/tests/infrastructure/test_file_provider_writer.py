import pytest
from pathlib import Path
from unittest.mock import MagicMock
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
