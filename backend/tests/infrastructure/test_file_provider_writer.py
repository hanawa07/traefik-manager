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
