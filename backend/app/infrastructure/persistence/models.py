from sqlalchemy import String, Boolean, DateTime, JSON, func
from sqlalchemy.orm import Mapped, mapped_column
from app.infrastructure.persistence.database import Base
import uuid


class ServiceModel(Base):
    __tablename__ = "services"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    upstream_host: Mapped[str] = mapped_column(String(255), nullable=False)
    upstream_port: Mapped[int] = mapped_column(nullable=False)
    tls_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    https_redirect_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    auth_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    allowed_ips: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    rate_limit_average: Mapped[int | None] = mapped_column(nullable=True)
    rate_limit_burst: Mapped[int | None] = mapped_column(nullable=True)
    custom_headers: Mapped[dict[str, str]] = mapped_column(JSON, default=dict, nullable=False)
    authentik_provider_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    authentik_app_slug: Mapped[str | None] = mapped_column(String(100), nullable=True)
    authentik_group_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    authentik_group_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    authentik_policy_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    authentik_policy_binding_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class RedirectHostModel(Base):
    __tablename__ = "redirect_hosts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    domain: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    target_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    permanent: Mapped[bool] = mapped_column(Boolean, default=True)
    tls_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())
