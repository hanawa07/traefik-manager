from app.application.backup.backup_serializers import (
    serialize_preview_redirect_item,
    serialize_preview_service_item,
    sort_preview_items,
)
from app.application.backup.backup_validator import validate_backup_payload
from app.domain.proxy.repositories.middleware_template_repository import (
    MiddlewareTemplateRepository,
)
from app.domain.proxy.repositories.redirect_host_repository import RedirectHostRepository
from app.domain.proxy.repositories.service_repository import ServiceRepository


async def preview_backup_import(
    *,
    mode: str,
    payload: dict,
    service_repository: ServiceRepository,
    middleware_template_repository: MiddlewareTemplateRepository,
    redirect_repository: RedirectHostRepository,
) -> dict:
    validation = await validate_backup_payload(payload, middleware_template_repository)
    services_payload = payload.get("services") or []
    redirects_payload = payload.get("redirect_hosts") or []

    existing_services = await service_repository.find_all()
    existing_redirects = await redirect_repository.find_all()

    service_items = [serialize_preview_service_item(item) for item in services_payload]
    redirect_items = [serialize_preview_redirect_item(item) for item in redirects_payload]

    if mode == "overwrite":
        return {
            "mode": mode,
            "service_count": validation["service_count"],
            "redirect_count": validation["redirect_count"],
            "warning_count": validation["warning_count"],
            "warnings": validation["warnings"],
            "services": {
                "creates": sort_preview_items(service_items),
                "updates": [],
                "deletes": sort_preview_items(
                    [
                        {"domain": str(service.domain), "name": service.name}
                        for service in existing_services
                    ]
                ),
            },
            "redirect_hosts": {
                "creates": sort_preview_items(redirect_items),
                "updates": [],
                "deletes": sort_preview_items(
                    [
                        {"domain": str(redirect.domain), "name": None}
                        for redirect in existing_redirects
                    ]
                ),
            },
        }

    existing_service_domains = {str(service.domain) for service in existing_services}
    existing_redirect_domains = {str(redirect.domain) for redirect in existing_redirects}

    return {
        "mode": mode,
        "service_count": validation["service_count"],
        "redirect_count": validation["redirect_count"],
        "warning_count": validation["warning_count"],
        "warnings": validation["warnings"],
        "services": {
            "creates": sort_preview_items(
                [item for item in service_items if item["domain"] not in existing_service_domains]
            ),
            "updates": sort_preview_items(
                [item for item in service_items if item["domain"] in existing_service_domains]
            ),
            "deletes": [],
        },
        "redirect_hosts": {
            "creates": sort_preview_items(
                [item for item in redirect_items if item["domain"] not in existing_redirect_domains]
            ),
            "updates": sort_preview_items(
                [item for item in redirect_items if item["domain"] in existing_redirect_domains]
            ),
            "deletes": [],
        },
    }
