import re

from app.core.versioning import compare_versions, parse_version


def extract_current_version(payload: dict | None) -> str | None:
    if not isinstance(payload, dict):
        return None
    for key in ("version", "Version"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def normalize_routers(payload: dict | list) -> list[dict]:
    if isinstance(payload, list):
        return [router for router in payload if isinstance(router, dict)]

    if isinstance(payload, dict):
        if "routers" in payload and isinstance(payload["routers"], list):
            return [router for router in payload["routers"] if isinstance(router, dict)]

        if all(isinstance(value, dict) for value in payload.values()):
            normalized = []
            for name, value in payload.items():
                router = value.copy()
                router.setdefault("name", name)
                normalized.append(router)
            return normalized

    return []


def normalize_middlewares(payload: dict | list) -> list[dict]:
    if isinstance(payload, list):
        return [middleware for middleware in payload if isinstance(middleware, dict)]

    if isinstance(payload, dict):
        if "middlewares" in payload and isinstance(payload["middlewares"], list):
            return [
                middleware
                for middleware in payload["middlewares"]
                if isinstance(middleware, dict)
            ]

        if all(isinstance(value, dict) for value in payload.values()):
            normalized = []
            for name, value in payload.items():
                middleware = value.copy()
                middleware.setdefault("name", name)
                normalized.append(middleware)
            return normalized

    return []


def extract_domains_from_router(router: dict) -> list[str]:
    domains: set[str] = set()

    rule = router.get("rule")
    if isinstance(rule, str):
        domains.update(extract_domains_from_rule(rule))

    tls = router.get("tls")
    if isinstance(tls, dict):
        tls_domains = tls.get("domains")
        if isinstance(tls_domains, list):
            for item in tls_domains:
                if not isinstance(item, dict):
                    continue
                main = item.get("main")
                if isinstance(main, str) and main:
                    domains.add(main)
                sans = item.get("sans")
                if isinstance(sans, list):
                    for san in sans:
                        if isinstance(san, str) and san:
                            domains.add(san)

    return sorted(domains)


def extract_domains_from_rule(rule: str) -> list[str]:
    domains: set[str] = set()
    for match in re.findall(r"Host\(([^)]+)\)", rule):
        for token in match.split(","):
            value = token.strip().strip("`").strip('"').strip("'")
            if value:
                domains.add(value)
    return list(domains)
