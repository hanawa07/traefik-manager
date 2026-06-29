from datetime import datetime

from app.infrastructure.traefik.certificate_preflight_probes import (
    inspect_presented_certificate,
    probe_http_challenge_path,
    resolve_public_dns_records,
)


def build_certificate_preflight_items(
    domain: str,
    certificate: dict | None,
    dns_result: dict,
    http_result: dict,
    https_result: dict,
) -> list[dict]:
    router_names = certificate.get("router_names", []) if certificate else []
    cert_resolvers = certificate.get("cert_resolvers", []) if certificate else []
    expires_at = certificate.get("expires_at") if certificate else None
    last_acme_error_message = certificate.get("last_acme_error_message") if certificate else None
    last_acme_error_kind = certificate.get("last_acme_error_kind") if certificate else None

    items: list[dict] = [
        {
            "key": "router_detected",
            "label": "라우트 감지",
            "status": "ok" if router_names else "error",
            "detail": (
                f"{len(router_names)}개 라우터가 이 도메인을 처리 중입니다"
                if router_names
                else f"{domain} 을 처리하는 Traefik 라우터를 찾지 못했습니다"
            ),
        },
        {
            "key": "cert_resolver",
            "label": "자동 발급 설정",
            "status": "ok" if cert_resolvers else "error",
            "detail": (
                f"certResolver {', '.join(cert_resolvers)} 사용"
                if cert_resolvers
                else "certResolver가 없어 자동 발급이 동작하지 않습니다"
            ),
        },
    ]

    if dns_result["ok"]:
        dns_detail = f"A {len(dns_result['a_records'])}개"
        if dns_result["aaaa_records"]:
            dns_detail += f", AAAA {len(dns_result['aaaa_records'])}개"
        else:
            dns_detail += ", AAAA 없음"
        items.append(
            {
                "key": "dns_public",
                "label": "공개 DNS 조회",
                "status": "ok",
                "detail": dns_detail,
            }
        )
    else:
        items.append(
            {
                "key": "dns_public",
                "label": "공개 DNS 조회",
                "status": "error",
                "detail": dns_result["error"] or "DNS 응답을 확인하지 못했습니다",
            }
        )

    if http_result["ok"]:
        detail = f"HTTP {http_result['status_code']} 응답"
        if http_result["location"]:
            detail += f" · Location {http_result['location']}"
        items.append(
            {
                "key": "http_challenge",
                "label": "HTTP challenge 경로",
                "status": "ok",
                "detail": detail,
            }
        )
    else:
        items.append(
            {
                "key": "http_challenge",
                "label": "HTTP challenge 경로",
                "status": "error",
                "detail": http_result["error"] or "80 포트 응답을 확인하지 못했습니다",
            }
        )

    if isinstance(expires_at, datetime):
        items.append(
            {
                "key": "https_certificate",
                "label": "HTTPS 제공 인증서",
                "status": "ok",
                "detail": "정식 인증서가 이미 응답 중입니다",
            }
        )
    elif https_result["ok"] and https_result["default_cert"]:
        items.append(
            {
                "key": "https_certificate",
                "label": "HTTPS 제공 인증서",
                "status": "warning",
                "detail": "현재 Traefik 기본 인증서가 응답 중입니다",
            }
        )
    elif https_result["ok"]:
        items.append(
            {
                "key": "https_certificate",
                "label": "HTTPS 제공 인증서",
                "status": "ok",
                "detail": https_result["subject_common_name"] or "인증서 응답 확인",
            }
        )
    else:
        items.append(
            {
                "key": "https_certificate",
                "label": "HTTPS 제공 인증서",
                "status": "error",
                "detail": https_result["error"] or "443 TLS 응답을 확인하지 못했습니다",
            }
        )

    items.append(
        {
            "key": "recent_acme_failure",
            "label": "최근 ACME 실패",
            "status": "warning" if last_acme_error_message else "ok",
            "detail": (
                f"{last_acme_error_kind} · {last_acme_error_message}"
                if last_acme_error_message and last_acme_error_kind
                else last_acme_error_message or "최근 ACME 실패 기록이 없습니다"
            ),
        }
    )
    return items


def compute_preflight_overall_status(items: list[dict]) -> str:
    if any(item["status"] == "error" for item in items):
        return "error"
    if any(item["status"] == "warning" for item in items):
        return "warning"
    return "ok"


def build_preflight_recommendation(items: list[dict], certificate: dict | None) -> str:
    item_map = {item["key"]: item for item in items}
    last_error_kind = certificate.get("last_acme_error_kind") if certificate else None

    if item_map["router_detected"]["status"] == "error":
        return "도메인 라우트가 실제로 생성됐는지 먼저 확인하세요."
    if item_map["cert_resolver"]["status"] == "error":
        return "TLS 설정과 certResolver 연결부터 확인하세요."
    if item_map["dns_public"]["status"] == "error" or last_error_kind == "dns":
        return "권한 DNS 응답과 A/AAAA 조회 결과를 먼저 확인하세요."
    if item_map["http_challenge"]["status"] == "error":
        return "80 포트 공개 상태와 challenge 경로 응답을 먼저 확인하세요."
    if item_map["https_certificate"]["status"] == "warning":
        return "기본 인증서 상태입니다. 잠시 뒤 다시 검사하거나 ACME 실패 사유를 확인하세요."
    if certificate and certificate.get("status") == "pending":
        return "발급 대기 상태입니다. 몇 분 뒤 경고 검사를 다시 실행하세요."
    return "추가 조치 없이 현재 상태만 모니터링하면 됩니다."
