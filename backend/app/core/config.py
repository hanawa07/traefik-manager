from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    APP_SECRET_KEY: str
    APP_PORT: int = 8000

    DATABASE_URL: str = "sqlite+aiosqlite:///./data/traefik_manager.db"

    TRAEFIK_CONFIG_PATH: str = "/traefik-config/dynamic"
    TRAEFIK_API_URL: str = "http://traefik:8080"
    TRAEFIK_API_TIMEOUT_SECONDS: float = 5.0

    DOCKER_SOCKET_PATH: str = "/var/run/docker.sock"
    DOCKER_API_VERSION: str = "v1.41"
    DOCKER_API_TIMEOUT_SECONDS: float = 5.0

    CLOUDFLARE_API_TOKEN: str | None = None
    CLOUDFLARE_ZONE_ID: str | None = None
    CLOUDFLARE_RECORD_TARGET: str | None = None
    CLOUDFLARE_PROXIED: bool = False
    CLOUDFLARE_API_TIMEOUT_SECONDS: float = 10.0

    AUTHENTIK_URL: str
    AUTHENTIK_TOKEN: str

    # ForwardAuth
    TOKEN_AUTH_FORWARD_AUTH_URL: str = "http://backend:8000/api/v1/auth/verify"

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    ALLOWED_HOSTS: list[str] = ["*"]

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    SESSION_COOKIE_NAME: str = "tm_session"
    SESSION_CSRF_COOKIE_NAME: str = "tm_csrf"
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
    SECURITY_ALERT_WEBHOOK_TIMEOUT_SECONDS: float = 5.0

    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str

    class Config:
        env_file = ".env"


settings = Settings()
