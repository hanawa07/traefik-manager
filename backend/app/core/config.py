from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    APP_SECRET_KEY: str
    APP_PORT: int = 8000

    DATABASE_URL: str = "sqlite+aiosqlite:///./data/traefik_manager.db"
    AUDIT_ARCHIVE_DIR: str = "/app/data/audit-archives"

    TRAEFIK_CONFIG_PATH: str = "/traefik-config/dynamic"
    TRAEFIK_API_URL: str = "http://traefik:8080"
    TRAEFIK_API_TIMEOUT_SECONDS: float = 5.0
    TRAEFIK_LATEST_VERSION_API_URL: str = "https://api.github.com/repos/traefik/traefik/releases/latest"
    TRAEFIK_LATEST_VERSION_TIMEOUT_SECONDS: float = 5.0
    TRAEFIK_LATEST_VERSION_CACHE_SECONDS: int = 3600
    TRAEFIK_TLS_CERT_RESOLVER: str | None = "letsencrypt"
    TRAEFIK_DOCKER_CONTAINER_NAME: str = "traefik"
    TRAEFIK_DOCKER_NETWORK: str = "proxy_net"
    TRAEFIK_ACME_STORAGE_PATH: str = "/letsencrypt/acme.json"
    TRAEFIK_LOG_TAIL_LINES: int = 2000
    TRAEFIK_UPDATE_REQUEST_DIR: str = "/host-requests/traefik-updates"
    TRAEFIK_UPDATE_HISTORY_PATH: str = "/host-state/traefik-manager/traefik-updates.jsonl"
    TRAEFIK_UPDATE_RUNNER_STATUS_PATH: str = (
        "/host-state/traefik-manager/traefik-update-runner.json"
    )

    DOCKER_SOCKET_PATH: str = "/var/run/docker.sock"
    DOCKER_READ_API_URL: str | None = None
    DOCKER_MUTATION_API_URL: str | None = None
    DOCKER_API_VERSION: str = "v1.41"
    DOCKER_API_TIMEOUT_SECONDS: float = 5.0

    TRAEFIK_MANAGER_VERSION: str = "v1.36.7"
    TRAEFIK_MANAGER_GIT_SHA: str = ""
    TRAEFIK_MANAGER_BUILD_DATE: str = ""
    TRAEFIK_MANAGER_IMAGE_SOURCE: str = "https://github.com/hanawa07/traefik-manager"
    TRAEFIK_MANAGER_LATEST_RELEASE_API_URL: str | None = None
    TRAEFIK_MANAGER_LATEST_RELEASE_TIMEOUT_SECONDS: float = 5.0
    TRAEFIK_MANAGER_LATEST_RELEASE_CACHE_SECONDS: int = 3600
    TRAEFIK_MANAGER_BACKEND_CONTAINER_NAME: str = "traefik-manager-backend"
    TRAEFIK_MANAGER_FRONTEND_CONTAINER_NAME: str = "traefik-manager-frontend"
    TRAEFIK_MANAGER_SLOT: str = "single"
    TRAEFIK_MANAGER_BACKGROUND_TASKS_ENABLED: bool = True
    TRAEFIK_MANAGER_LOG_TAIL_LINES: int = 5000
    TRAEFIK_MANAGER_REQUEST_LOG_PATH: str = "./data/manager-http-requests.jsonl"
    SMOKE_ROTATION_LOG_PATH: str = "/host-state/traefik-manager/smoke-password-rotation.log"
    MANAGER_DEPLOYMENT_HISTORY_PATH: str = "/host-state/traefik-manager/blue-green-deployments.jsonl"
    MANAGER_DEPLOYMENT_BOTTLENECK_CONFIG_PATH: str = (
        "/traefik-config/.runtime/manager-deployment-bottleneck.conf"
    )

    CLOUDFLARE_API_TOKEN: str | None = None
    CLOUDFLARE_ZONE_ID: str | None = None
    CLOUDFLARE_RECORD_TARGET: str | None = None
    CLOUDFLARE_PROXIED: bool = False
    CLOUDFLARE_API_TIMEOUT_SECONDS: float = 10.0

    AUTHENTIK_URL: str
    AUTHENTIK_TOKEN: str

    # ForwardAuth
    TOKEN_AUTH_FORWARD_AUTH_URL: str = "http://traefik-manager-backend:8000/api/v1/auth/verify"

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    ALLOWED_HOSTS: list[str] = ["*"]

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    SESSION_COOKIE_NAME: str = "tm_session"
    SESSION_CSRF_COOKIE_NAME: str = "tm_csrf"
    SMOKE_VIEWER_USERNAME: str = "traefik-smoke-viewer"
    SMOKE_ADMIN_USERNAME: str = "traefik-smoke-admin"
    SESSION_IDLE_MINUTES: int = 480
    SESSION_ABSOLUTE_MINUTES: int = 10080
    AUTH_SESSION_CLEANUP_INTERVAL_MINUTES: int = 30
    SESSION_COOKIE_SAMESITE: str = "lax"
    SESSION_COOKIE_SECURE: bool = True
    LOGIN_MAX_FAILED_ATTEMPTS: int = 5
    LOGIN_FAILURE_WINDOW_MINUTES: int = 15
    LOGIN_LOCKOUT_MINUTES: int = 15
    LOGIN_SUSPICIOUS_WINDOW_MINUTES: int = 15
    LOGIN_SUSPICIOUS_FAILURE_COUNT: int = 5
    LOGIN_SUSPICIOUS_USERNAME_COUNT: int = 3
    LOGIN_SUSPICIOUS_BLOCK_MINUTES: int = 30
    LOGIN_SUSPICIOUS_BLOCK_ESCALATION_ENABLED: bool = False
    LOGIN_SUSPICIOUS_BLOCK_ESCALATION_WINDOW_MINUTES: int = 1440
    LOGIN_SUSPICIOUS_BLOCK_ESCALATION_MULTIPLIER: int = 2
    LOGIN_SUSPICIOUS_BLOCK_MAX_MINUTES: int = 1440
    SECURITY_ALERT_WEBHOOK_TIMEOUT_SECONDS: float = 5.0
    SECURITY_ALERT_EMAIL_TIMEOUT_SECONDS: float = 10.0
    CERTIFICATE_ALERT_WARNING_DAYS: int = 30
    CERTIFICATE_ALERT_CHECK_INTERVAL_MINUTES: int = 360
    CERTIFICATE_PREFLIGHT_AUTO_CHECK_INTERVAL_MINUTES: int = 60
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_THRESHOLD: int = 3
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_WINDOW_MINUTES: int = 240
    CERTIFICATE_PREFLIGHT_REPEAT_ALERT_COOLDOWN_MINUTES: int = 240
    TURNSTILE_VERIFY_TIMEOUT_SECONDS: float = 5.0

    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str
settings = Settings()
