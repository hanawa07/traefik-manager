from typing import Any

from fastapi import APIRouter

from app.interfaces.api.v1.routers.settings_standard_endpoint_factory import (
    ReadSettings,
    UpdateSettings,
    build_read_endpoint,
    build_update_endpoint,
)
from app.interfaces.api.v1.routers.settings_standard_route_specs import (
    STANDARD_ROUTE_SPECS,
    SettingsStandardEndpoints,
)


def register_settings_standard_routes(
    *,
    router: APIRouter,
    settings_routes,
    read_settings: ReadSettings,
    update_settings: UpdateSettings,
) -> SettingsStandardEndpoints:
    endpoints: dict[str, Any] = {}
    for spec in STANDARD_ROUTE_SPECS:
        read_endpoint = build_read_endpoint(
            route=getattr(settings_routes, spec.read_route_name),
            function_name=spec.read_function_name,
            read_settings=read_settings,
        )
        router.add_api_route(
            spec.path,
            read_endpoint,
            methods=["GET"],
            response_model=spec.response_model,
            summary=spec.read_summary,
        )
        endpoints[spec.read_function_name] = read_endpoint

        update_endpoint = build_update_endpoint(
            route=getattr(settings_routes, spec.update_route_name),
            request_model=spec.update_request_model,
            function_name=spec.update_function_name,
            update_settings=update_settings,
        )
        router.add_api_route(
            spec.path,
            update_endpoint,
            methods=["PUT"],
            response_model=spec.response_model,
            summary=spec.update_summary,
        )
        endpoints[spec.update_function_name] = update_endpoint

    return SettingsStandardEndpoints(**endpoints)
