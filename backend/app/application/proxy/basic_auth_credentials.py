from app.core.security import hash_basic_auth_password


def hash_basic_auth_credentials(
    credentials: list[dict],
    existing_users: list[str] | None = None,
) -> list[str]:
    if not credentials:
        return []

    existing_hash_map = {}
    if existing_users:
        for user_str in existing_users:
            if ":" in user_str:
                username, password_hash = user_str.split(":", 1)
                existing_hash_map[username] = password_hash

    users: list[str] = []
    seen_usernames: set[str] = set()
    for item in credentials:
        if isinstance(item, dict):
            username = str(item.get("username", "")).strip()
            password = str(item.get("password", ""))
        else:
            username = str(getattr(item, "username", "")).strip()
            password = str(getattr(item, "password", ""))

        if not username:
            continue
        if username in seen_usernames:
            raise ValueError(f"중복된 Basic Auth 사용자 이름입니다: {username}")

        seen_usernames.add(username)

        if password:
            users.append(f"{username}:{hash_basic_auth_password(password)}")
        elif username in existing_hash_map:
            users.append(f"{username}:{existing_hash_map[username]}")
        else:
            raise ValueError(f"새 사용자 '{username}'의 비밀번호를 입력해야 합니다")

    return users
