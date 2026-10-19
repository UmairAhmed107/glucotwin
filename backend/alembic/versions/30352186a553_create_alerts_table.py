"""create_alerts_table

Revision ID: 30352186a553
Revises: a1403f031156
Create Date: 2026-10-19 19:04:31.785701

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '30352186a553'
down_revision: Union[str, Sequence[str], None] = 'a1403f031156'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "alerts" not in insp.get_table_names():
        op.create_table(
            "alerts",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
            sa.Column("rule_key", sa.String(length=64), nullable=False),
            sa.Column("severity", sa.String(length=16), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("acknowledged_by", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="open"),
        )
        op.create_index("ix_alerts_id", "alerts", ["id"])
        op.create_index("ix_alerts_patient_id", "alerts", ["patient_id"])
        op.create_index("ix_alerts_rule_key", "alerts", ["rule_key"])
        op.create_index("ix_alerts_status", "alerts", ["status"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("alerts")

