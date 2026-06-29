from dataclasses import dataclass
import secrets

from .service_normalizers import normalize_auth_mode


@dataclass(frozen=True)
class CreatedServiceAuthState:
    auth_mode: str
    auth_enabled: bool
    api_key: str | None
    authentik_group_id: str | None


@dataclass(frozen=True)
class UpdatedServiceAuthState:
    auth_mode: str
    auth_enabled: bool
    api_key: str | None
    clear_basic_auth_users: bool
    clear_authentik_group: bool


def resolve_created_auth_state(
    *,
    auth_mode: str,
    auth_enabled: bool | None,
    api_key: str | None,
    basic_auth_users: list[str] | None,
    authentik_group_id: str | None,
) -> CreatedServiceAuthState:
    resolved_auth_mode = normalize_auth_mode(auth_mode=auth_mode, auth_enabled=auth_enabled)
    _ensure_auth_mode_allows_basic_auth(resolved_auth_mode, basic_auth_users)
    return CreatedServiceAuthState(
        auth_mode=resolved_auth_mode,
        auth_enabled=resolved_auth_mode != "none",
        api_key=_resolve_api_key(resolved_auth_mode, api_key),
        authentik_group_id=authentik_group_id if resolved_auth_mode == "authentik" else None,
    )


def resolve_updated_auth_state(
    *,
    current_auth_mode: str,
    current_api_key: str | None,
    requested_auth_mode: str | None,
    requested_auth_enabled: bool | None,
    requested_api_key: str | None,
) -> UpdatedServiceAuthState | None:
    if requested_auth_mode is None and requested_auth_enabled is not None:
        requested_auth_mode = "authentik" if requested_auth_enabled else "none"

    if requested_auth_mode is None:
        if current_auth_mode == "token" and requested_api_key:
            return UpdatedServiceAuthState(
                auth_mode=current_auth_mode,
                auth_enabled=True,
                api_key=requested_api_key,
                clear_basic_auth_users=False,
                clear_authentik_group=False,
            )
        return None

    resolved_auth_mode = normalize_auth_mode(auth_mode=requested_auth_mode)
    return UpdatedServiceAuthState(
        auth_mode=resolved_auth_mode,
        auth_enabled=resolved_auth_mode != "none",
        api_key=_resolve_api_key(resolved_auth_mode, requested_api_key or current_api_key),
        clear_basic_auth_users=resolved_auth_mode != "none",
        clear_authentik_group=resolved_auth_mode != "authentik",
    )


def ensure_basic_auth_allowed(auth_enabled: bool, basic_auth_users: list[str]) -> None:
    if basic_auth_users and auth_enabled:
        raise ValueError("인증 모드와 Basic Auth는 동시에 활성화할 수 없습니다")


def _resolve_api_key(auth_mode: str, api_key: str | None) -> str | None:
    if auth_mode == "token":
        return api_key or f"service_{secrets.token_urlsafe(32)}"
    return None


def _ensure_auth_mode_allows_basic_auth(
    auth_mode: str,
    basic_auth_users: list[str] | None,
) -> None:
    if auth_mode == "authentik" and basic_auth_users:
        raise ValueError("Authentik 인증과 Basic Auth는 동시에 활성화할 수 없습니다")
    if auth_mode == "token" and basic_auth_users:
        raise ValueError("Token 인증과 Basic Auth는 동시에 활성화할 수 없습니다")
