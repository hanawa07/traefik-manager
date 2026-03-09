"""add auth mode

Revision ID: 20260310_03
Revises: 20260310_02
Create Date: 2026-03-10 03:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260310_03'
down_revision = '20260310_02'
branch_labels = None
depends_on = None


def upgrade():
    # 1. auth_mode 컬럼 추가
    op.add_column('services', sa.Column('auth_mode', sa.String(length=20), nullable=False, server_default='none'))
    
    # 2. 기존 auth_enabled=1 인 레코드를 'authentik'으로 업데이트
    op.execute("UPDATE services SET auth_mode='authentik' WHERE auth_enabled=1")


def downgrade():
    op.drop_column('services', 'auth_mode')
