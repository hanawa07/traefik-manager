from dataclasses import dataclass
import hmac
import hashlib
import secrets

from app.core.config import settings


@dataclass(frozen=True)
class SessionCredentials:
    session_id: str
    secret: str
    secret_hash: str
    cookie_value: str


def hash_session_secret(secret: str) -> str:
    return hmac.new(
        settings.APP_SECRET_KEY.encode("utf-8"),
        secret.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def verify_session_secret(secret: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_session_secret(secret), expected_hash)


def build_session_cookie_value(session_id: str, secret: str) -> str:
    return f"{session_id}.{secret}"


def parse_session_cookie(value: str | None) -> tuple[str, str] | None:
    if not value:
        return None
    parts = value.split(".")
    if len(parts) != 2:
        return None
    session_id, secret = parts
    if not session_id or not secret:
        return None
    return session_id, secret


def issue_session_credentials() -> SessionCredentials:
    session_id = secrets.token_urlsafe(18)
    secret = secrets.token_urlsafe(32)
    secret_hash = hash_session_secret(secret)
    return SessionCredentials(
        session_id=session_id,
        secret=secret,
        secret_hash=secret_hash,
        cookie_value=build_session_cookie_value(session_id, secret),
    )


def issue_csrf_token() -> str:
    return secrets.token_urlsafe(32)

