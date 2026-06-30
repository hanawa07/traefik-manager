from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.auth import login_anomaly_service
from app.application.auth.auth_use_cases import AuthUseCases
from app.application.audit import audit_service
from app.core.config import settings
from app.core.session_security import issue_csrf_token, issue_session_credentials
from app.infrastructure.persistence.database import get_db
from app.infrastructure.persistence.models import ServiceModel
from app.infrastructure.persistence.repositories.sqlite_auth_session_repository import (
    SQLiteAuthSessionRepository,
)
from app.infrastructure.persistence.repositories.sqlite_system_settings_repository import (
    SQLiteSystemSettingsRepository,
)
from app.infrastructure.persistence.repositories.sqlite_user_repository import (
    SQLiteUserRepository,
)
from app.infrastructure.security import turnstile_verifier
from app.interfaces.api.dependencies import get_current_user, resolve_authenticated_user
from app.interfaces.api.v1.routers.auth_forward_routes import register_auth_forward_routes
from app.interfaces.api.v1.routers.auth_login_routes import register_auth_login_routes
from app.interfaces.api.v1.routers.auth_session_routes import (
    register_auth_session_routes,
)
from app.interfaces.api.v1.routers.auth_session_helpers import (
    clear_auth_cookies as _clear_auth_cookies,
    set_auth_cookies as _set_auth_cookies,
    to_session_response as _to_session_response,
)

router = APIRouter()


def get_use_cases(db: AsyncSession = Depends(get_db)) -> AuthUseCases:
    return AuthUseCases(SQLiteUserRepository(db))


_login_endpoints = register_auth_login_routes(
    router,
    get_use_cases=get_use_cases,
    auth_session_repository_factory_provider=lambda: SQLiteAuthSessionRepository,
    system_settings_repository_factory_provider=lambda: SQLiteSystemSettingsRepository,
    issue_session_credentials_provider=lambda: issue_session_credentials,
    issue_csrf_token_provider=lambda: issue_csrf_token,
    set_auth_cookies_func=_set_auth_cookies,
    audit_service_provider=lambda: audit_service,
    login_anomaly_service_provider=lambda: login_anomaly_service,
    turnstile_verifier_provider=lambda: turnstile_verifier,
    settings_provider=lambda: settings,
)
login = _login_endpoints.login
get_login_protection = _login_endpoints.get_login_protection

_session_endpoints = register_auth_session_routes(
    router,
    current_user_dependency=get_current_user,
    auth_session_repository_factory_provider=lambda: SQLiteAuthSessionRepository,
    clear_auth_cookies_func=_clear_auth_cookies,
    to_session_response_func=_to_session_response,
)
get_current_session = _session_endpoints.get_current_session
list_sessions = _session_endpoints.list_sessions
logout = _session_endpoints.logout
logout_all_sessions = _session_endpoints.logout_all_sessions
revoke_session = _session_endpoints.revoke_session

_forward_endpoints = register_auth_forward_routes(
    router,
    service_model_provider=lambda: ServiceModel,
    resolve_authenticated_user_provider=lambda: resolve_authenticated_user,
)
verify_token = _forward_endpoints.verify_token
