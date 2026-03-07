from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"
    APP_SECRET_KEY: str
    APP_PORT: int = 8000

    DATABASE_URL: str = "sqlite+aiosqlite:///./data/traefik_manager.db"

    TRAEFIK_CONFIG_PATH: str = "/traefik-config/dynamic"
    TRAEFIK_API_URL: str = "http://traefik:8080"
    TRAEFIK_API_TIMEOUT_SECONDS: float = 5.0

    AUTHENTIK_URL: str
    AUTHENTIK_TOKEN: str

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]
    ALLOWED_HOSTS: list[str] = ["*"]

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str

    class Config:
        env_file = ".env"


settings = Settings()
