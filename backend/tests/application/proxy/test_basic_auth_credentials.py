import pytest

from app.application.proxy.basic_auth_credentials import hash_basic_auth_credentials


def test_hash_basic_auth_credentials_hashes_new_password():
    users = hash_basic_auth_credentials([{"username": "alice", "password": "secret"}])

    assert len(users) == 1
    username, password_hash = users[0].split(":", 1)
    assert username == "alice"
    assert password_hash
    assert password_hash != "secret"


def test_hash_basic_auth_credentials_keeps_existing_hash_when_password_empty():
    users = hash_basic_auth_credentials(
        [{"username": "alice", "password": ""}],
        existing_users=["alice:$2b$12$existing"],
    )

    assert users == ["alice:$2b$12$existing"]


def test_hash_basic_auth_credentials_rejects_duplicate_usernames():
    with pytest.raises(ValueError, match="중복된 Basic Auth 사용자 이름"):
        hash_basic_auth_credentials(
            [
                {"username": "alice", "password": "secret"},
                {"username": "alice", "password": "other"},
            ]
        )


def test_hash_basic_auth_credentials_requires_password_for_new_user():
    with pytest.raises(ValueError, match="비밀번호를 입력해야 합니다"):
        hash_basic_auth_credentials([{"username": "alice", "password": ""}])
