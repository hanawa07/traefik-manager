"""initial schema

Revision ID: 20260307_01
Revises:
Create Date: 2026-03-07 14:10:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20260307_01"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "middleware_templates",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "redirect_hosts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("target_url", sa.String(length=2048), nullable=False),
        sa.Column("permanent", sa.Boolean(), nullable=False),
        sa.Column("tls_enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("domain"),
    )

    op.create_table(
        "services",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=False),
        sa.Column("upstream_host", sa.String(length=255), nullable=False),
        sa.Column("upstream_port", sa.Integer(), nullable=False),
        sa.Column("tls_enabled", sa.Boolean(), nullable=False),
        sa.Column("https_redirect_enabled", sa.Boolean(), nullable=False),
        sa.Column("auth_enabled", sa.Boolean(), nullable=False),
        sa.Column("allowed_ips", sa.JSON(), nullable=False),
        sa.Column("rate_limit_average", sa.Integer(), nullable=True),
        sa.Column("rate_limit_burst", sa.Integer(), nullable=True),
        sa.Column("custom_headers", sa.JSON(), nullable=False),
        sa.Column("basic_auth_users", sa.JSON(), nullable=False),
        sa.Column("middleware_template_ids", sa.JSON(), nullable=False),
        sa.Column("authentik_provider_id", sa.String(length=100), nullable=True),
        sa.Column("authentik_app_slug", sa.String(length=100), nullable=True),
        sa.Column("authentik_group_id", sa.String(length=100), nullable=True),
        sa.Column("authentik_group_name", sa.String(length=255), nullable=True),
        sa.Column("authentik_policy_id", sa.String(length=100), nullable=True),
        sa.Column("authentik_policy_binding_id", sa.String(length=100), nullable=True),
        sa.Column("cloudflare_record_id", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("domain"),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("username", sa.String(length=100), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )


def downgrade() -> None:
    op.drop_table("users")
    op.drop_table("services")
    op.drop_table("redirect_hosts")
    op.drop_table("middleware_templates")
