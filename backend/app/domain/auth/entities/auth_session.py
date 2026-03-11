from dataclasses import dataclass
from datetime import datetime, timedelta, timezone


def _to_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@dataclass
class AuthSession:
    id: str
    user_id: str
    username: str
    role: str
    token_version: int
    session_secret_hash: str
    issued_at: datetime
    last_seen_at: datetime | None
    expires_at: datetime
    idle_expires_at: datetime
    revoked_at: datetime | None = None
    revoked_reason: str | None = None
    ip_address: str | None = None
    user_agent: str | None = None

    def __post_init__(self) -> None:
        self.issued_at = _to_utc(self.issued_at)
        self.last_seen_at = _to_utc(self.last_seen_at)
        self.expires_at = _to_utc(self.expires_at)
        self.idle_expires_at = _to_utc(self.idle_expires_at)
        self.revoked_at = _to_utc(self.revoked_at)

    @classmethod
    def issue(
        cls,
        session_id: str,
        session_secret_hash: str,
        user_id: str,
        username: str,
        role: str,
        token_version: int,
        absolute_ttl: timedelta,
        idle_ttl: timedelta,
        now: datetime | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> "AuthSession":
        issued_at = _to_utc(now or datetime.now(timezone.utc))
        return cls(
            id=session_id.strip(),
            user_id=user_id.strip(),
            username=username.strip(),
            role=role.strip(),
            token_version=int(token_version),
            session_secret_hash=session_secret_hash.strip(),
            issued_at=issued_at,
            last_seen_at=issued_at,
            expires_at=issued_at + absolute_ttl,
            idle_expires_at=issued_at + idle_ttl,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    def revoke(self, reason: str, revoked_at: datetime | None = None) -> None:
        self.revoked_reason = reason.strip()
        self.revoked_at = _to_utc(revoked_at or datetime.now(timezone.utc))

    def touch(self, now: datetime, idle_ttl: timedelta) -> None:
        current = _to_utc(now)
        self.last_seen_at = current
        self.idle_expires_at = current + idle_ttl

    def is_active(self, now: datetime) -> bool:
        current = _to_utc(now)
        return self.revoked_at is None and current < self.expires_at and current < self.idle_expires_at
