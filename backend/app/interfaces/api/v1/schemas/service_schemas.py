from app.interfaces.api.v1.schemas.service_request_schemas import ServiceCreate, ServiceUpdate
from app.interfaces.api.v1.schemas.service_response_schemas import (
    AuthentikGroupResponse,
    ServiceGatewayDiagnosisResponse,
    ServiceResponse,
    UpstreamHealthResponse,
)

__all__ = [
    "AuthentikGroupResponse",
    "ServiceCreate",
    "ServiceGatewayDiagnosisResponse",
    "ServiceResponse",
    "ServiceUpdate",
    "UpstreamHealthResponse",
]
