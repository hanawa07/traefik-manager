from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class RevokedToken:
    jti: str
    expires_at: datetime
    revoked_at: datetime
    username: str | None = None

    @classmethod
    def revoke(
        cls,
        jti: str,
        expires_at: datetime,
        username: str | None = None,
        revoked_at: datetime | None = None,
    ) -> "RevokedToken":
        normalized_jti = jti.strip()
        if not normalized_jti:
            raise ValueError("토큰 JTI는 필수입니다")
        if expires_at.tzinfo is None:
            raise ValueError("토큰 만료 시각은 timezone-aware여야 합니다")
        return cls(
            jti=normalized_jti,
            expires_at=expires_at.astimezone(timezone.utc),
            revoked_at=(revoked_at or datetime.now(timezone.utc)).astimezone(timezone.utc),
            username=username.strip() if username else None,
        )
