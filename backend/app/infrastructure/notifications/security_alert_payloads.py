from typing import Any

from app.infrastructure.notifications.security_alert_messages import (
    build_message,
    build_multiline_message,
    build_telegram_message,
)


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


def _build_pagerduty_severity(event: str, category: str) -> str:
    if category == "change":
        return "info"
    if event == "login_blocked_ip":
        return "critical"
    if event == "login_locked":
        return "error"
    return "warning"
