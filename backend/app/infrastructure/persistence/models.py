from sqlalchemy import String, Boolean, DateTime, Integer, JSON, func
from sqlalchemy.orm import Mapped, mapped_column
from app.infrastructure.persistence.base import Base
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
    basic_auth_users: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    middleware_template_ids: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    authentik_provider_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    authentik_app_slug: Mapped[str | None] = mapped_column(String(100), nullable=True)
    authentik_group_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    authentik_group_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    authentik_policy_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    authentik_policy_binding_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cloudflare_record_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
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


class MiddlewareTemplateModel(Base):
    __tablename__ = "middleware_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    config: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class AuditLogModel(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor: Mapped[str] = mapped_column(String(100), nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # create, update, delete
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)  # service, redirect, middleware, user
    resource_id: Mapped[str] = mapped_column(String(36), nullable=False)
    resource_name: Mapped[str] = mapped_column(String(255), nullable=False)
    detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime, server_default=func.now())
