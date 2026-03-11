import importlib
import warnings


def test_settings_ignores_unknown_environment_variables(monkeypatch):
    monkeypatch.setenv("APP_SECRET_KEY", "test-secret-key")
    monkeypatch.setenv("AUTHENTIK_URL", "http://authentik.test")
    monkeypatch.setenv("AUTHENTIK_TOKEN", "test-token")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-jwt-secret-key")
    monkeypatch.setenv("ADMIN_PASSWORD", "test-admin-password")
    monkeypatch.setenv("FRONTEND_DOMAIN", "traefik-manager.lizstudio.co.kr")
    monkeypatch.setenv("BACKEND_DOMAIN", "traefik-manager-api.lizstudio.co.kr")
    monkeypatch.setenv("NEXT_PUBLIC_API_URL", "/api/v1")
    monkeypatch.setenv("BACKEND_UPSTREAM_URL", "http://backend:8000")

    from app.core.config import Settings

    settings = Settings(_env_file=None)

    assert settings.APP_PORT == 8000


def test_pydantic_models_do_not_emit_class_config_deprecation_warning():
    module_names = [
        "app.core.config",
        "app.interfaces.api.v1.schemas.service_schemas",
        "app.interfaces.api.v1.schemas.user_schemas",
        "app.interfaces.api.v1.schemas.audit_schemas",
        "app.interfaces.api.v1.schemas.middleware_schemas",
        "app.interfaces.api.v1.schemas.redirect_schemas",
    ]

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", DeprecationWarning)
        for module_name in module_names:
            module = importlib.import_module(module_name)
            importlib.reload(module)

    deprecation_warnings = [
        warning
        for warning in caught
        if "Support for class-based `config` is deprecated" in str(warning.message)
    ]
    assert deprecation_warnings == []
