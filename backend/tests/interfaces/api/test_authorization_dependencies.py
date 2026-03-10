from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi import HTTPException

from app.domain.proxy.entities.user import User
from app.interfaces.api import dependencies
from app.interfaces.api.dependencies import require_admin, require_write_access


class StubUserRepository:
    def __init__(self, user: User | None):
        self.user = user

    async def find_by_username(self, username: str):
        if self.user and self.user.username == username:
            return self.user
        return None


class StubRevokedTokenRepository:
    def __init__(self, revoked_jtis: set[str]):
        self.revoked_jtis = revoked_jtis

    async def is_revoked(self, jti: str) -> bool:
        return jti in self.revoked_jtis

@pytest.mark.asyncio
async def test_require_write_access_allows_admin():
    user = {"username": "admin", "role": "admin"}

    resolved = await require_write_access(user)

    assert resolved["role"] == "admin"

@pytest.mark.asyncio
async def test_require_write_access_blocks_viewer():
    user = {"username": "viewer", "role": "viewer"}

    with pytest.raises(HTTPException) as exc:
        await require_write_access(user)

    assert exc.value.status_code == 403

@pytest.mark.asyncio
async def test_require_admin_blocks_viewer():
    user = {"username": "viewer", "role": "viewer"}

    with pytest.raises(HTTPException) as exc:
        await require_admin(user)

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_get_current_user_blocks_revoked_token(monkeypatch):
    user = User(
        id=uuid4(),
        username="admin",
        hashed_password="hashed",
        role="admin",
        is_active=True,
        token_version=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    payload = {
        "sub": "admin",
        "ver": 0,
        "jti": "revoked-token",
        "exp": int((datetime.now(timezone.utc) + timedelta(minutes=30)).timestamp()),
    }

    monkeypatch.setattr(dependencies, "decode_token", lambda _token: payload)
    monkeypatch.setattr(dependencies, "SQLiteUserRepository", lambda _db: StubUserRepository(user))
    monkeypatch.setattr(
        dependencies,
        "SQLiteRevokedTokenRepository",
        lambda _db: StubRevokedTokenRepository({"revoked-token"}),
    )

    with pytest.raises(HTTPException) as exc:
        await dependencies.get_current_user(token="token", db=object())

    assert exc.value.status_code == 401
    assert exc.value.detail == "로그아웃된 토큰입니다. 다시 로그인해주세요"


@pytest.mark.asyncio
async def test_get_current_user_returns_token_metadata(monkeypatch):
    user = User(
        id=uuid4(),
        username="admin",
        hashed_password="hashed",
        role="admin",
        is_active=True,
        token_version=0,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    payload = {
        "sub": "admin",
        "ver": 0,
        "jti": "active-token",
        "exp": int(expires_at.timestamp()),
    }

    monkeypatch.setattr(dependencies, "decode_token", lambda _token: payload)
    monkeypatch.setattr(dependencies, "SQLiteUserRepository", lambda _db: StubUserRepository(user))
    monkeypatch.setattr(
        dependencies,
        "SQLiteRevokedTokenRepository",
        lambda _db: StubRevokedTokenRepository(set()),
    )

    current_user = await dependencies.get_current_user(token="token", db=object())

    assert current_user["username"] == "admin"
    assert current_user["token_jti"] == "active-token"
    assert int(current_user["token_exp"].timestamp()) == int(expires_at.timestamp())
