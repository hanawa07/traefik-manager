from copy import deepcopy

USER_CREATE_EVENT = "user_create"
USER_UPDATE_EVENT = "user_update"
USER_DELETE_EVENT = "user_delete"
USER_ROLLBACK_EVENT = "user_rollback"


def user_audit_summary(user, *, password_changed: bool) -> dict[str, object]:
    return {
        "username": getattr(user, "username", ""),
        "role": getattr(user, "role", ""),
        "is_active": bool(getattr(user, "is_active", True)),
        "password_changed": password_changed,
    }


def changed_user_keys(before_summary: dict[str, object], after_summary: dict[str, object]) -> list[str]:
    return sorted(
        [
            key
            for key in set(before_summary.keys()) | set(after_summary.keys())
            if before_summary.get(key) != after_summary.get(key)
        ]
    )


def build_user_rollback_payload(
    before_summary: dict[str, object],
    changed_keys: list[str],
    update_payload: dict[str, object],
) -> dict[str, object] | None:
    if "password" in update_payload:
        return None

    payload: dict[str, object] = {}
    for key in changed_keys:
        if key in {"username", "role", "is_active"}:
            payload[key] = deepcopy(before_summary[key])
    return payload or None
