from datetime import datetime, timezone
from math import ceil


WARNING_THRESHOLD_DAYS = 30


def to_certificate_response(cert: dict) -> dict:
    now = datetime.now(timezone.utc)
    expires_at = cert.get("expires_at")
    cert_resolvers = sorted(cert["cert_resolvers"])

    status = "warning"
    message = "만료일 정보를 확인할 수 없습니다"
    days_remaining = None

    if isinstance(expires_at, datetime):
        remaining_seconds = (expires_at - now).total_seconds()
        days_remaining = ceil(remaining_seconds / 86400)
        if expires_at < now:
            status = "error"
            message = "인증서가 만료되었습니다"
        elif remaining_seconds <= WARNING_THRESHOLD_DAYS * 86400:
            status = "warning"
            message = f"{days_remaining}일 이내 만료 예정"
        else:
            status = "active"
            message = "정상"
    elif cert_resolvers:
        status = "pending"
        message = "정식 인증서 발급 대기 또는 검증 실패"
    else:
        status = "inactive"
        message = "자동 인증서 발급 미설정"

    return {
        "domain": cert["domain"],
        "router_names": sorted(cert["router_names"]),
        "cert_resolvers": cert_resolvers,
        "expires_at": expires_at,
        "days_remaining": days_remaining,
        "status": status,
        "status_message": message,
        "last_acme_error_at": cert.get("last_acme_error_at"),
        "last_acme_error_message": cert.get("last_acme_error_message"),
        "last_acme_error_kind": cert.get("last_acme_error_kind"),
    }
