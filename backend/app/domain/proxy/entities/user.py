from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
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
    failed_login_attempts: int = 0
    last_failed_login_at: datetime | None = None
    locked_until: datetime | None = None

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
            failed_login_attempts=0,
            last_failed_login_at=None,
            locked_until=None,
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

    def is_login_locked(self, now: datetime | None = None) -> bool:
        current = now or datetime.now(timezone.utc)
        return self.locked_until is not None and self.locked_until > current

    def clear_expired_login_lock(self, now: datetime | None = None) -> bool:
        current = now or datetime.now(timezone.utc)
        if self.locked_until is None or self.locked_until > current:
            return False
        self.failed_login_attempts = 0
        self.last_failed_login_at = None
        self.locked_until = None
        self.updated_at = current
        return True

    def register_login_failure(
        self,
        *,
        max_failed_attempts: int,
        failure_window: timedelta,
        lockout_duration: timedelta,
        now: datetime | None = None,
    ) -> None:
        current = now or datetime.now(timezone.utc)
        self.clear_expired_login_lock(current)
        if (
            self.last_failed_login_at is None
            or current - self.last_failed_login_at > failure_window
        ):
            self.failed_login_attempts = 1
        else:
            self.failed_login_attempts += 1
        self.last_failed_login_at = current
        if self.failed_login_attempts >= max_failed_attempts:
            self.locked_until = current + lockout_duration
        self.updated_at = current

    def register_login_success(self, now: datetime | None = None) -> None:
        current = now or datetime.now(timezone.utc)
        self.failed_login_attempts = 0
        self.last_failed_login_at = None
        self.locked_until = None
        self.updated_at = current

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
