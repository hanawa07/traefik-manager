SETTINGS_TEST_EVENTS = {
    "cloudflare": "settings_test_cloudflare",
    "cloudflare_drift": "settings_test_cloudflare_drift",
    "cloudflare_reconcile": "settings_test_cloudflare_reconcile",
    "security_alert": "settings_test_security_alert",
    "smoke_admin_stale": "settings_test_smoke_admin_stale",
}

SETTINGS_DELIVERY_EVENTS = {
    "security_alert_delivery": {
        "security_alert_delivery_success",
        "security_alert_delivery_failure",
    },
    "change_alert_delivery": {
        "change_alert_delivery_success",
        "change_alert_delivery_failure",
    },
}

SETTINGS_UPDATE_EVENTS = {
    "cloudflare": "settings_update_cloudflare",
    "traefik_dashboard": "settings_update_traefik_dashboard",
    "time_display": "settings_update_time_display",
    "certificate_diagnostics": "settings_update_certificate_diagnostics",
    "upstream_security": "settings_update_upstream_security",
    "login_defense": "settings_update_login_defense",
    "security_alert": "settings_update_security_alert",
    "smoke_monitoring": "settings_update_smoke_monitoring",
    "deployment_bottleneck": "settings_update_deployment_bottleneck",
}

SETTINGS_ROLLBACK_EVENTS = {
    SETTINGS_UPDATE_EVENTS["time_display"]: "settings_rollback_time_display",
    SETTINGS_UPDATE_EVENTS["upstream_security"]: "settings_rollback_upstream_security",
}
