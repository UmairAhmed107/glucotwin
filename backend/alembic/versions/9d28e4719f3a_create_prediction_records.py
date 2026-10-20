"""create prediction records table

Revision ID: 9d28e4719f3a
Revises: 7c19a3b841f2
Create Date: 2026-10-19 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9d28e4719f3a'
down_revision = '7c19a3b841f2'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'prediction_records' not in tables:
        op.create_table(
            'prediction_records',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('patient_id', sa.Integer(), sa.ForeignKey('patients.id', ondelete='CASCADE'), nullable=False),
            sa.Column('meal_id', sa.Integer(), sa.ForeignKey('meal_entries.id', ondelete='SET NULL'), nullable=True),
            sa.Column('predicted_peak_rise', sa.Float(), nullable=False),
            sa.Column('p10', sa.Float(), nullable=False),
            sa.Column('p90', sa.Float(), nullable=False),
            sa.Column('model_version', sa.String(length=100), nullable=False, server_default='15-ensemble-bootstrap'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('actual_peak_rise', sa.Float(), nullable=True),
            sa.Column('actual_iauc_2h', sa.Float(), nullable=True),
            sa.Column('error', sa.Float(), nullable=True),
            sa.Column('in_range', sa.Boolean(), nullable=True),
            sa.Column('reconciled_at', sa.DateTime(timezone=True), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index(op.f('ix_prediction_records_id'), 'prediction_records', ['id'], unique=False)
        op.create_index(op.f('ix_prediction_records_patient_id'), 'prediction_records', ['patient_id'], unique=False)
        op.create_index(op.f('ix_prediction_records_meal_id'), 'prediction_records', ['meal_id'], unique=False)
        op.create_index(op.f('ix_prediction_records_created_at'), 'prediction_records', ['created_at'], unique=False)


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'prediction_records' in tables:
        op.drop_table('prediction_records')
