import pytest

from app.core.session_security import (
    build_session_cookie_value,
    hash_session_secret,
    issue_csrf_token,
    issue_session_credentials,
    parse_session_cookie,
    verify_session_secret,
)


def test_issue_session_credentials_returns_cookie_ready_parts():
    credentials = issue_session_credentials()

    assert credentials.session_id
    assert credentials.secret
    assert credentials.secret_hash
    assert credentials.cookie_value == build_session_cookie_value(credentials.session_id, credentials.secret)
    assert verify_session_secret(credentials.secret, credentials.secret_hash) is True


def test_parse_session_cookie_rejects_malformed_value():
    assert parse_session_cookie("") is None
    assert parse_session_cookie("session-only") is None
    assert parse_session_cookie("too.many.parts.here") is None


def test_hash_and_verify_session_secret():
    secret_hash = hash_session_secret("plain-secret")

    assert verify_session_secret("plain-secret", secret_hash) is True
    assert verify_session_secret("wrong-secret", secret_hash) is False


def test_issue_csrf_token_returns_non_empty_value():
    token = issue_csrf_token()

    assert isinstance(token, str)
    assert len(token) >= 32

