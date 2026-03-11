import base64
import hashlib
import hmac
import re
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import bcrypt
import jwt
from fastapi import HTTPException, status
from jwt import InvalidTokenError

from app.core.config import settings

_BCRYPT_ROUNDS = 12
_BCRYPT_PREFIX = b"2b"
_RAW_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")
_BCRYPT_SHA256_V2_RE = re.compile(
    r"^\$bcrypt-sha256\$v=(?P<version>\d+),t=(?P<ident>2b),r=(?P<rounds>\d{1,2})\$(?P<salt>[^$]{22})\$(?P<digest>[^$]{31})$"
)
_BCRYPT_SHA256_V1_RE = re.compile(
    r"^\$bcrypt-sha256\$(?P<ident>2[ab]),(?P<rounds>\d{1,2})\$(?P<salt>[^$]{22})\$(?P<digest>[^$]{31})$"
)


def _normalize_bcrypt_hash_prefix(hash_value: str) -> str:
    if hash_value.startswith("$2y$"):
        return "$2b$" + hash_value[4:]
    return hash_value


def _extract_bcrypt_parts(hash_value: str) -> tuple[str, int, str, str]:
    normalized = _normalize_bcrypt_hash_prefix(hash_value)
    parts = normalized.split("$")
    if len(parts) != 4 or not parts[3] or len(parts[3]) != 53:
        raise ValueError("유효하지 않은 bcrypt 해시 형식입니다")
    ident = parts[1]
    rounds = int(parts[2])
    salt_and_digest = parts[3]
    return ident, rounds, salt_and_digest[:22], salt_and_digest[22:]


def _prepare_bcrypt_sha256_secret(secret: str, salt: str, version: int) -> bytes:
    secret_bytes = secret.encode("utf-8")
    if version == 1:
        digest = hashlib.sha256(secret_bytes).digest()
    elif version == 2:
        digest = hmac.new(salt.encode("ascii"), secret_bytes, hashlib.sha256).digest()
    else:
        raise ValueError("지원하지 않는 bcrypt_sha256 버전입니다")
    return base64.b64encode(digest)


def _format_bcrypt_sha256_hash(
    *,
    version: int,
    ident: str,
    rounds: int,
    salt: str,
    digest: str,
) -> str:
    if version == 1:
        return f"$bcrypt-sha256${ident},{rounds}${salt}${digest}"
    return f"$bcrypt-sha256$v={version},t={ident},r={rounds}${salt}${digest}"


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=_BCRYPT_ROUNDS, prefix=_BCRYPT_PREFIX)
    _, ident, rounds_text, salt_text = salt.decode("ascii").split("$")
    rounds = int(rounds_text)
    prepared = _prepare_bcrypt_sha256_secret(password, salt_text, version=2)
    raw_hash = bcrypt.hashpw(prepared, salt).decode("ascii")
    _, _, _, digest = _extract_bcrypt_parts(raw_hash)
    return _format_bcrypt_sha256_hash(
        version=2,
        ident=ident,
        rounds=rounds,
        salt=salt_text,
        digest=digest,
    )


def verify_password(plain: str, hashed: str) -> bool:
    try:
        if hashed.startswith("$bcrypt-sha256$"):
            match = _BCRYPT_SHA256_V2_RE.match(hashed)
            version = 2
            if match is None:
                match = _BCRYPT_SHA256_V1_RE.match(hashed)
                version = 1
            if match is None:
                return False

            ident = match.group("ident")
            rounds = int(match.group("rounds"))
            salt = match.group("salt")
            digest = match.group("digest")
            bcrypt_hash = f"${ident}${rounds:02d}${salt}{digest}"
            prepared = _prepare_bcrypt_sha256_secret(plain, salt, version=version)
            return bcrypt.checkpw(prepared, bcrypt_hash.encode("ascii"))

        if hashed.startswith(_RAW_BCRYPT_PREFIXES):
            return bcrypt.checkpw(
                plain.encode("utf-8"),
                _normalize_bcrypt_hash_prefix(hashed).encode("ascii"),
            )
    except ValueError:
        return False
    return False


def hash_basic_auth_password(password: str) -> str:
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=_BCRYPT_ROUNDS))
    return hashed.decode("ascii")


def create_access_token(data: dict, token_version: int = 0) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload["ver"] = token_version
    payload["jti"] = str(uuid4())
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_token_expiration(payload: dict) -> datetime | None:
    exp = payload.get("exp")
    if exp is None:
        return None
    if isinstance(exp, (int, float)):
        return datetime.fromtimestamp(exp, timezone.utc)
    if isinstance(exp, datetime):
        if exp.tzinfo is None:
            return exp.replace(tzinfo=timezone.utc)
        return exp.astimezone(timezone.utc)
    return None
