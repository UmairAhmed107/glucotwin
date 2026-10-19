"""create_visits_drafts_and_care_plans

Revision ID: 4b82c19e5f10
Revises: 30352186a553
Create Date: 2026-10-19 19:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b82c19e5f10'
down_revision: Union[str, Sequence[str], None] = '30352186a553'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    # 1. visits
    if "visits" not in tables:
        op.create_table(
            "visits",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
            sa.Column("clinician_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="scheduled"),
            sa.Column("pre_visit_summary", sa.JSON(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("final_plan", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_visits_id", "visits", ["id"])
        op.create_index("ix_visits_patient_id", "visits", ["patient_id"])
        op.create_index("ix_visits_clinician_id", "visits", ["clinician_id"])
        op.create_index("ix_visits_status", "visits", ["status"])

    # 2. recommendation_drafts
    if "recommendation_drafts" not in tables:
        op.create_table(
            "recommendation_drafts",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("visit_id", sa.Integer(), sa.ForeignKey("visits.id", ondelete="CASCADE"), nullable=False),
            sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
            sa.Column("category", sa.String(length=50), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("detail", sa.Text(), nullable=True),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
            sa.Column("clinician_comment", sa.Text(), nullable=True),
            sa.Column("governor_trace", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_recommendation_drafts_id", "recommendation_drafts", ["id"])
        op.create_index("ix_recommendation_drafts_visit_id", "recommendation_drafts", ["visit_id"])
        op.create_index("ix_recommendation_drafts_patient_id", "recommendation_drafts", ["patient_id"])
        op.create_index("ix_recommendation_drafts_status", "recommendation_drafts", ["status"])

    # 3. care_plans
    if "care_plans" not in tables:
        op.create_table(
            "care_plans",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
            sa.Column("visit_id", sa.Integer(), sa.ForeignKey("visits.id", ondelete="SET NULL"), nullable=True),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
        op.create_index("ix_care_plans_id", "care_plans", ["id"])
        op.create_index("ix_care_plans_patient_id", "care_plans", ["patient_id"])
        op.create_index("ix_care_plans_visit_id", "care_plans", ["visit_id"])
        op.create_index("ix_care_plans_status", "care_plans", ["status"])

    # 4. care_plan_tasks
    if "care_plan_tasks" not in tables:
        op.create_table(
            "care_plan_tasks",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("care_plan_id", sa.Integer(), sa.ForeignKey("care_plans.id", ondelete="CASCADE"), nullable=False),
            sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id", ondelete="CASCADE"), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("due_date", sa.DateTime(timezone=True), nullable=False),
            sa.Column("category", sa.String(length=50), nullable=False),
            sa.Column("assigned_to", sa.String(length=50), nullable=False, server_default="patient"),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index("ix_care_plan_tasks_id", "care_plan_tasks", ["id"])
        op.create_index("ix_care_plan_tasks_care_plan_id", "care_plan_tasks", ["care_plan_id"])
        op.create_index("ix_care_plan_tasks_patient_id", "care_plan_tasks", ["patient_id"])
        op.create_index("ix_care_plan_tasks_status", "care_plan_tasks", ["status"])


def downgrade() -> None:
    op.drop_table("care_plan_tasks")
    op.drop_table("care_plans")
    op.drop_table("recommendation_drafts")
    op.drop_table("visits")
