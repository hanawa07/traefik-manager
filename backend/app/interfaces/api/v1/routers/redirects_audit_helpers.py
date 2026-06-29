from copy import deepcopy

REDIRECT_CREATE_EVENT = "redirect_create"
REDIRECT_UPDATE_EVENT = "redirect_update"
REDIRECT_DELETE_EVENT = "redirect_delete"
REDIRECT_ROLLBACK_EVENT = "redirect_rollback"


def redirect_audit_summary(redirect_host) -> dict[str, object]:
    return {
        "domain": str(getattr(redirect_host, "domain", "")),
        "target_url": getattr(redirect_host, "target_url", ""),
        "permanent": bool(getattr(redirect_host, "permanent", True)),
        "tls_enabled": bool(getattr(redirect_host, "tls_enabled", True)),
    }


def changed_redirect_keys(before_summary: dict[str, object], after_summary: dict[str, object]) -> list[str]:
    return sorted(
        [
            key
            for key in set(before_summary.keys()) | set(after_summary.keys())
            if before_summary.get(key) != after_summary.get(key)
        ]
    )


def build_redirect_rollback_payload(
    before_summary: dict[str, object],
    changed_keys: list[str],
) -> dict[str, object]:
    return {key: deepcopy(before_summary[key]) for key in changed_keys if key in before_summary}
