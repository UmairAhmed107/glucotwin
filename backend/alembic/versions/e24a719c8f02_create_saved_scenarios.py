"""create saved_scenarios table

Revision ID: e24a719c8f02
Revises: 9d28e4719f3a
Create Date: 2026-10-19 21:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e24a719c8f02'
down_revision = '9d28e4719f3a'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'saved_scenarios' not in tables:
        op.create_table(
            'saved_scenarios',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('description', sa.Text(), nullable=True),
            sa.Column('inputs', sa.JSON(), nullable=False),
            sa.Column('baseline_output', sa.JSON(), nullable=False),
            sa.Column('intervention_output', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_saved_scenarios_id'), 'saved_scenarios', ['id'], unique=False)
        op.create_index(op.f('ix_saved_scenarios_patient_id'), 'saved_scenarios', ['patient_id'], unique=False)
        op.create_index(op.f('ix_saved_scenarios_created_at'), 'saved_scenarios', ['created_at'], unique=False)


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'saved_scenarios' in tables:
        op.drop_table('saved_scenarios')
