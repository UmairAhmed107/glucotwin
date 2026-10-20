"""create foods saved meals and medications

Revision ID: 7c19a3b841f2
Revises: 4b82c19e5f10
Create Date: 2026-10-19 20:25:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7c19a3b841f2'
down_revision = '4b82c19e5f10'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    # 1. food_items table
    if 'food_items' not in tables:
        op.create_table(
            'food_items',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('serving_description', sa.String(length=255), nullable=False),
            sa.Column('carbs', sa.Float(), nullable=False),
            sa.Column('protein', sa.Float(), nullable=False),
            sa.Column('fat', sa.Float(), nullable=False),
            sa.Column('calories', sa.Float(), nullable=False),
            sa.Column('fiber', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('category', sa.String(length=100), nullable=True),
            sa.Column('is_demo', sa.Boolean(), nullable=False, server_default='1'),
            sa.Column('disclaimer', sa.String(length=255), nullable=False, server_default='Approximate demo data for clinical educational testing'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_food_items_id'), 'food_items', ['id'], unique=False)
        op.create_index(op.f('ix_food_items_name'), 'food_items', ['name'], unique=False)
        op.create_index(op.f('ix_food_items_category'), 'food_items', ['category'], unique=False)

    # 2. saved_meals table
    if 'saved_meals' not in tables:
        op.create_table(
            'saved_meals',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('patient_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('items', sa.JSON(), nullable=False),
            sa.Column('computed_carbs', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('computed_protein', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('computed_fat', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('computed_calories', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('computed_fiber', sa.Float(), nullable=False, server_default='0.0'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_saved_meals_id'), 'saved_meals', ['id'], unique=False)
        op.create_index(op.f('ix_saved_meals_patient_id'), 'saved_meals', ['patient_id'], unique=False)

    # 3. medications table
    if 'medications' not in tables:
        op.create_table(
            'medications',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('patient_id', sa.Integer(), nullable=False),
            sa.Column('name', sa.String(length=255), nullable=False),
            sa.Column('dosage', sa.String(length=100), nullable=False),
            sa.Column('schedule', sa.String(length=100), nullable=False),
            sa.Column('frequency_per_day', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_medications_id'), 'medications', ['id'], unique=False)
        op.create_index(op.f('ix_medications_patient_id'), 'medications', ['patient_id'], unique=False)

    # 4. dose_logs table
    if 'dose_logs' not in tables:
        op.create_table(
            'dose_logs',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('medication_id', sa.Integer(), nullable=False),
            sa.Column('patient_id', sa.Integer(), nullable=False),
            sa.Column('dose', sa.String(length=100), nullable=False),
            sa.Column('scheduled_time', sa.DateTime(timezone=True), nullable=False),
            sa.Column('taken_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='taken'),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.ForeignKeyConstraint(['medication_id'], ['medications.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['patient_id'], ['patients.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_dose_logs_id'), 'dose_logs', ['id'], unique=False)
        op.create_index(op.f('ix_dose_logs_medication_id'), 'dose_logs', ['medication_id'], unique=False)
        op.create_index(op.f('ix_dose_logs_patient_id'), 'dose_logs', ['patient_id'], unique=False)
        op.create_index(op.f('ix_dose_logs_scheduled_time'), 'dose_logs', ['scheduled_time'], unique=False)
        op.create_index(op.f('ix_dose_logs_status'), 'dose_logs', ['status'], unique=False)


def downgrade():
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'dose_logs' in tables:
        op.drop_table('dose_logs')
    if 'medications' in tables:
        op.drop_table('medications')
    if 'saved_meals' in tables:
        op.drop_table('saved_meals')
    if 'food_items' in tables:
        op.drop_table('food_items')
