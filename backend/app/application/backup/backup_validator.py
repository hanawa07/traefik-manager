from app.domain.proxy.repositories.middleware_template_repository import (
    MiddlewareTemplateRepository,
)
from app.application.backup.backup_template_resolver import resolve_middleware_templates


async def validate_backup_payload(
    payload: dict,
    middleware_template_repository: MiddlewareTemplateRepository,
) -> dict:
    services_payload = payload.get("services") or []
    redirects_payload = payload.get("redirect_hosts") or []
    warnings: list[str] = []

    seen_service_domains: set[str] = set()
    seen_redirect_domains: set[str] = set()

    for item in services_payload:
        domain = item["domain"]
        if domain in seen_service_domains:
            warnings.append(f"중복 서비스 도메인: {domain}")
        seen_service_domains.add(domain)
        await resolve_middleware_templates(
            middleware_template_repository,
            item.get("middleware_template_ids") or [],
        )

    for item in redirects_payload:
        domain = item["domain"]
        if domain in seen_redirect_domains:
            warnings.append(f"중복 리다이렉트 도메인: {domain}")
        if domain in seen_service_domains:
            warnings.append(f"서비스와 리다이렉트가 같은 도메인을 사용합니다: {domain}")
        seen_redirect_domains.add(domain)

    return {
        "valid": True,
        "service_count": len(services_payload),
        "redirect_count": len(redirects_payload),
        "warning_count": len(warnings),
        "warnings": warnings,
    }
