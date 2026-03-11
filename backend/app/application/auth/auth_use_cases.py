from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from app.core.config import settings
from app.core.security import verify_password
from app.domain.proxy.entities.user import User
from app.domain.proxy.repositories.user_repository import UserRepository


AuthenticationFailureReason = Literal["invalid_credentials", "locked"]


@dataclass
class AuthenticationResult:
    authenticated_user: User | None
    subject_user: User | None = None
    failure_reason: AuthenticationFailureReason | None = None
    locked_until: datetime | None = None


class AuthUseCases:
    def __init__(
        self,
        repository: UserRepository,
        *,
        max_failed_attempts: int = settings.LOGIN_MAX_FAILED_ATTEMPTS,
        failure_window_minutes: int = settings.LOGIN_FAILURE_WINDOW_MINUTES,
        lockout_minutes: int = settings.LOGIN_LOCKOUT_MINUTES,
    ):
        self.repository = repository
        self.max_failed_attempts = max(1, max_failed_attempts)
        self.failure_window = timedelta(minutes=max(1, failure_window_minutes))
        self.lockout_duration = timedelta(minutes=max(1, lockout_minutes))

    async def authenticate_user(
        self,
        username: str,
        password: str,
        *,
        now: datetime | None = None,
    ) -> AuthenticationResult:
        current = now or datetime.now(timezone.utc)
        user = await self.repository.find_by_username(username.strip())
        if not user or not user.is_active:
            return AuthenticationResult(
                authenticated_user=None,
                subject_user=None,
                failure_reason="invalid_credentials",
            )
        if user.clear_expired_login_lock(current):
            await self.repository.save(user)
        if user.is_login_locked(current):
            return AuthenticationResult(
                authenticated_user=None,
                subject_user=user,
                failure_reason="locked",
                locked_until=user.locked_until,
            )
        if not verify_password(password, user.hashed_password):
            user.register_login_failure(
                max_failed_attempts=self.max_failed_attempts,
                failure_window=self.failure_window,
                lockout_duration=self.lockout_duration,
                now=current,
            )
            await self.repository.save(user)
            return AuthenticationResult(
                authenticated_user=None,
                subject_user=user,
                failure_reason="locked" if user.is_login_locked(current) else "invalid_credentials",
                locked_until=user.locked_until,
            )
        if user.failed_login_attempts or user.last_failed_login_at is not None or user.locked_until is not None:
            user.register_login_success(current)
            await self.repository.save(user)
        return AuthenticationResult(
            authenticated_user=user,
            subject_user=user,
        )
