import base64
from datetime import datetime, timedelta, timezone
import hashlib
import warnings

import bcrypt
import jwt
import pytest
from fastapi import HTTPException
from uuid import UUID

from app.core.config import settings
from app.core.security import create_access_token, decode_token, hash_password, verify_password

def test_jwt_create_and_decode():
    data = {"sub": "admin"}
    token = create_access_token(data)
    decoded = decode_token(token)
    assert decoded["sub"] == "admin"
    assert "exp" in decoded
    assert "jti" in decoded
    UUID(decoded["jti"])

def test_jwt_decode_expired_token():
    data = {"sub": "admin", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)}
    token = jwt.encode(data, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

    with pytest.raises(HTTPException) as exc:
        decode_token(token)

    assert exc.value.status_code == 401
    assert exc.value.detail == "유효하지 않은 토큰입니다"

def test_jwt_decode_invalid_token():
    with pytest.raises(HTTPException) as exc:
        decode_token("invalid-token")

    assert exc.value.status_code == 401
    assert exc.value.detail == "유효하지 않은 토큰입니다"


def test_jwt_create_and_decode_do_not_emit_utcnow_deprecation_warning():
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", DeprecationWarning)
        token = create_access_token({"sub": "admin"})
        decoded = decode_token(token)

    assert decoded["sub"] == "admin"
    utcnow_warnings = [
        warning for warning in caught if "datetime.datetime.utcnow() is deprecated" in str(warning.message)
    ]
    assert utcnow_warnings == []


def test_password_hash_and_verify_legacy_compatible_without_crypt_warning():
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always", DeprecationWarning)
        hashed = hash_password("secret123")
        verified = verify_password("secret123", hashed)

    assert hashed.startswith("$bcrypt-sha256$")
    assert verified is True
    crypt_warnings = [warning for warning in caught if "'crypt' is deprecated" in str(warning.message)]
    assert crypt_warnings == []


def test_verify_password_supports_legacy_bcrypt_sha256_v1():
    salt = b"$2b$12$g9gaKnTbR3nB2lG8KT2k3e"
    digest = base64.b64encode(hashlib.sha256(b"secret123").digest())
    raw_hash = bcrypt.hashpw(digest, salt).decode("ascii")
    legacy_hash = f"$bcrypt-sha256$2b,12${raw_hash[7:29]}${raw_hash[29:]}"
    assert verify_password("secret123", legacy_hash) is True
