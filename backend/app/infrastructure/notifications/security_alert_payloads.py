from typing import Any


def build_payload(audit_log: Any, event: str, category: str) -> dict[str, Any]:
    detail = audit_log.detail or {}
    return {
        "source": "traefik-manager",
        "category": category,
        "event": event,
        "actor": audit_log.actor,
        "resource_type": audit_log.resource_type,
        "resource_id": audit_log.resource_id,
        "resource_name": audit_log.resource_name,
        "client_ip": detail.get("client_ip"),
        "created_at": audit_log.created_at.isoformat(),
        "detail": detail,
        "message": build_message(event, audit_log.resource_name, detail.get("client_ip"), category),
    }


def build_message(event: str, resource_name: str, client_ip: Any, category: str) -> str:
    if category == "security" and event == "login_locked":
        return f"계정 잠금 감지: {resource_name}"
    if category == "security" and event == "login_suspicious":
        return f"이상 징후 로그인 감지: {client_ip or resource_name}"
    if category == "security":
        return f"이상 징후 IP 차단: {client_ip or resource_name}"
    if event.startswith("settings_update_"):
        return f"설정 변경: {resource_name}"
    if event == "service_create":
        return f"서비스 생성: {resource_name}"
    if event == "service_update":
        return f"서비스 변경: {resource_name}"
    if event == "service_delete":
        return f"서비스 삭제: {resource_name}"
    if event == "redirect_create":
        return f"리다이렉트 생성: {resource_name}"
    if event == "redirect_update":
        return f"리다이렉트 변경: {resource_name}"
    if event == "redirect_delete":
        return f"리다이렉트 삭제: {resource_name}"
    if event == "middleware_create":
        return f"미들웨어 생성: {resource_name}"
    if event == "middleware_update":
        return f"미들웨어 변경: {resource_name}"
    if event == "middleware_delete":
        return f"미들웨어 삭제: {resource_name}"
    if event == "user_create":
        return f"사용자 생성: {resource_name}"
    if event == "user_update":
        return f"사용자 변경: {resource_name}"
    if event == "user_delete":
        return f"사용자 삭제: {resource_name}"
    if event == "certificate_warning":
        return f"인증서 만료 임박: {resource_name}"
    if event == "certificate_error":
        return f"인증서 만료: {resource_name}"
    if event == "certificate_recovered":
        return f"인증서 복구: {resource_name}"
    if event == "certificate_preflight_repeated_failure":
        return f"인증서 발급 반복 실패: {resource_name}"
    return f"롤백 실행: {resource_name}"


def build_slack_payload(audit_log: Any, event: str, category: str) -> dict[str, Any]:
    message = build_message(event, audit_log.resource_name, (audit_log.detail or {}).get("client_ip"), category)
    title = "Traefik Manager 운영 알림" if category == "change" else "Traefik Manager 보안 경고"
    return {
        "text": f"[Traefik Manager] {message}",
        "blocks": [
            {
                "type": "header",
                "text": {"type": "plain_text", "text": title},
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": build_multiline_message(audit_log, event, category),
                },
            },
        ],
    }


def build_discord_payload(audit_log: Any, event: str, category: str) -> dict[str, Any]:
    detail = audit_log.detail or {}
    title = "Traefik Manager 운영 알림" if category == "change" else "Traefik Manager 보안 경고"
    return {
        "content": f"[Traefik Manager] {build_message(event, audit_log.resource_name, detail.get('client_ip'), category)}",
        "embeds": [
            {
                "title": title,
                "description": build_multiline_message(audit_log, event, category),
                "fields": [
                    {"name": "이벤트", "value": event, "inline": True},
                    {"name": "대상", "value": audit_log.resource_name or "-", "inline": True},
                    {"name": "IP", "value": str(detail.get("client_ip") or "-"), "inline": True},
                ],
            }
        ],
    }


def build_teams_payload(audit_log: Any, event: str, category: str) -> dict[str, Any]:
    detail = audit_log.detail or {}
    title = "Traefik Manager 운영 알림" if category == "change" else "Traefik Manager 보안 경고"
    return {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "contentUrl": None,
                "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "body": [
                        {
                            "type": "TextBlock",
                            "size": "Medium",
                            "weight": "Bolder",
                            "text": title,
                        },
                        {
                            "type": "TextBlock",
                            "wrap": True,
                            "text": build_message(event, audit_log.resource_name, detail.get("client_ip"), category),
                        },
                        {
                            "type": "FactSet",
                            "facts": [
                                {"title": "이벤트", "value": event},
                                {"title": "대상", "value": audit_log.resource_name or "-"},
                                {"title": "IP", "value": str(detail.get("client_ip") or "-")},
                                {"title": "시각", "value": audit_log.created_at.isoformat()},
                            ],
                        },
                    ],
                },
            }
        ],
    }


def build_pagerduty_payload(audit_log: Any, event: str, routing_key: str, category: str) -> dict[str, Any]:
    detail = audit_log.detail or {}
    source = str(detail.get("client_ip") or audit_log.resource_name or "traefik-manager")
    return {
        "routing_key": routing_key,
        "event_action": "trigger",
        "payload": {
            "summary": build_message(event, audit_log.resource_name, detail.get("client_ip"), category),
            "source": source,
            "severity": _build_pagerduty_severity(event, category),
            "component": "traefik-manager",
            "group": category,
            "class": event,
            "custom_details": build_payload(audit_log, event, category),
        },
    }


def build_telegram_message(audit_log: Any, event: str, category: str) -> str:
    return build_multiline_message(audit_log, event, category).replace("*", "")


def build_multiline_message(audit_log: Any, event: str, category: str) -> str:
    detail = audit_log.detail or {}
    lines = [
        build_message(event, audit_log.resource_name, detail.get("client_ip"), category),
        f"이벤트: {event}",
        f"대상: {audit_log.resource_name or '-'}",
        f"행위자: {audit_log.actor or '-'}",
        f"IP: {detail.get('client_ip') or '-'}",
        f"시각: {audit_log.created_at.isoformat()}",
    ]
    if category == "security" and event == "login_blocked_ip":
        if detail.get("block_minutes") is not None:
            lines.append(f"차단 시간: {detail.get('block_minutes')}분")
        if detail.get("repeat_count") is not None:
            lines.append(f"반복 차단 횟수: {detail.get('repeat_count')}")
        if detail.get("blocked_until"):
            lines.append(f"차단 해제 시각: {detail.get('blocked_until')}")
    if category == "change":
        changed_keys = detail.get("changed_keys")
        if isinstance(changed_keys, list) and changed_keys:
            lines.append(f"변경 키: {', '.join(str(item) for item in changed_keys)}")
        if detail.get("days_remaining") is not None:
            lines.append(f"남은 기간: {detail.get('days_remaining')}일")
        if detail.get("expires_at"):
            lines.append(f"만료 시각: {detail.get('expires_at')}")
        if detail.get("source_audit_id"):
            lines.append(f"원본 변경 로그: {detail.get('source_audit_id')}")
    return "\n".join(lines)


def _build_pagerduty_severity(event: str, category: str) -> str:
    if category == "change":
        return "info"
    if event == "login_blocked_ip":
        return "critical"
    if event == "login_locked":
        return "error"
    return "warning"
