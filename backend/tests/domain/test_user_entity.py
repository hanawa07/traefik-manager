from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.domain.proxy.entities.user import User


def make_user() -> User:
    now = datetime.now(timezone.utc)
    return User(
        id=uuid4(),
        username="admin",
        hashed_password="hashed",
        role="admin",
        is_active=True,
        token_version=0,
        created_at=now,
        updated_at=now,
    )


def test_register_login_failure_locks_after_threshold_within_window():
    user = make_user()
    now = datetime(2026, 3, 11, 12, 0, tzinfo=timezone.utc)

    user.register_login_failure(
        max_failed_attempts=3,
        failure_window=timedelta(minutes=15),
        lockout_duration=timedelta(minutes=10),
        now=now,
    )
    user.register_login_failure(
        max_failed_attempts=3,
        failure_window=timedelta(minutes=15),
        lockout_duration=timedelta(minutes=10),
        now=now + timedelta(minutes=1),
    )
    user.register_login_failure(
        max_failed_attempts=3,
        failure_window=timedelta(minutes=15),
        lockout_duration=timedelta(minutes=10),
        now=now + timedelta(minutes=2),
    )

    assert user.failed_login_attempts == 3
    assert user.locked_until == now + timedelta(minutes=12)
    assert user.is_login_locked(now + timedelta(minutes=3)) is True


def test_register_login_failure_resets_counter_after_window():
    user = make_user()
    now = datetime(2026, 3, 11, 12, 0, tzinfo=timezone.utc)

    user.register_login_failure(
        max_failed_attempts=3,
        failure_window=timedelta(minutes=5),
        lockout_duration=timedelta(minutes=10),
        now=now,
    )
    user.register_login_failure(
        max_failed_attempts=3,
        failure_window=timedelta(minutes=5),
        lockout_duration=timedelta(minutes=10),
        now=now + timedelta(minutes=6),
    )

    assert user.failed_login_attempts == 1
    assert user.locked_until is None


def test_register_login_success_clears_failure_state():
    user = make_user()
    now = datetime(2026, 3, 11, 12, 0, tzinfo=timezone.utc)
    user.failed_login_attempts = 2
    user.locked_until = now + timedelta(minutes=5)
    user.last_failed_login_at = now

    user.register_login_success(now + timedelta(minutes=1))

    assert user.failed_login_attempts == 0
    assert user.locked_until is None
    assert user.last_failed_login_at is None
