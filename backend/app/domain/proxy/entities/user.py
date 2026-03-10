from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Literal
from uuid import UUID, uuid4


UserRole = Literal["admin", "viewer"]


@dataclass
class User:
    id: UUID
    username: str
    hashed_password: str
    role: UserRole
    is_active: bool
    token_version: int
    created_at: datetime
    updated_at: datetime

    @classmethod
    def create(
        cls,
        username: str,
        hashed_password: str,
        role: UserRole,
        is_active: bool = True,
    ) -> "User":
        now = datetime.now(timezone.utc)
        return cls(
            id=uuid4(),
            username=cls._normalize_username(username),
            hashed_password=cls._normalize_hashed_password(hashed_password),
            role=cls._normalize_role(role),
            is_active=bool(is_active),
            token_version=0,
            created_at=now,
            updated_at=now,
        )

    def update(
        self,
        username: str | None = None,
        hashed_password: str | None = None,
        role: UserRole | None = None,
        is_active: bool | None = None,
    ) -> None:
        if username is not None:
            self.username = self._normalize_username(username)
        if hashed_password is not None:
            self.hashed_password = self._normalize_hashed_password(hashed_password)
            self.token_version += 1  # 비밀번호 변경 시 기존 토큰 무효화
        if role is not None:
            self.role = self._normalize_role(role)
        if is_active is not None:
            self.is_active = bool(is_active)
        self.updated_at = datetime.now(timezone.utc)

    def invalidate_tokens(self) -> None:
        """로그아웃 시 기존 발급된 모든 JWT 무효화"""
        self.token_version += 1
        self.updated_at = datetime.now(timezone.utc)

    @staticmethod
    def _normalize_username(username: str) -> str:
        value = username.strip()
        if not value:
            raise ValueError("사용자 이름은 필수입니다")
        return value

    @staticmethod
    def _normalize_hashed_password(hashed_password: str) -> str:
        value = hashed_password.strip()
        if not value:
            raise ValueError("비밀번호 해시값은 필수입니다")
        return value

    @staticmethod
    def _normalize_role(role: UserRole) -> UserRole:
        if role not in {"admin", "viewer"}:
            raise ValueError("지원하지 않는 사용자 역할입니다")
        return role
