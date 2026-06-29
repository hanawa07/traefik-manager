from copy import deepcopy

MIDDLEWARE_CREATE_EVENT = "middleware_create"
MIDDLEWARE_UPDATE_EVENT = "middleware_update"
MIDDLEWARE_DELETE_EVENT = "middleware_delete"
MIDDLEWARE_ROLLBACK_EVENT = "middleware_rollback"


def middleware_audit_summary(template) -> dict[str, object]:
    return {
        "name": getattr(template, "name", ""),
        "type": getattr(template, "type", ""),
        "config": deepcopy(getattr(template, "config", {})),
    }


def changed_middleware_keys(before_summary: dict[str, object], after_summary: dict[str, object]) -> list[str]:
    return sorted(
        [
            key
            for key in set(before_summary.keys()) | set(after_summary.keys())
            if before_summary.get(key) != after_summary.get(key)
        ]
    )


def build_middleware_rollback_payload(
    before_summary: dict[str, object],
    changed_keys: list[str],
) -> dict[str, object]:
    return {key: deepcopy(before_summary[key]) for key in changed_keys if key in before_summary}
