"""add pgvector and transcript chunks

Revision ID: a1b2c3d4e5f6
Revises: 98bc1995561e
Create Date: 2026-10-21 23:45:00.000000

"""
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '98bc1995561e'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    # Enable pgvector extension on PostgreSQL
    if bind and bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 1. Add vector index status columns to recordings
    with op.batch_alter_table('recordings', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('index_status', sa.String(length=32), server_default='pending', nullable=False)
        )
        batch_op.add_column(sa.Column('indexed_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('index_error', sa.Text(), nullable=True))
        batch_op.create_index(batch_op.f('ix_recordings_index_status'), ['index_status'], unique=False)

    # 2. Create transcript_chunks table
    op.create_table(
        'transcript_chunks',
        sa.Column('id', sa.Uuid(as_uuid=True), nullable=False),
        sa.Column('recording_id', sa.Uuid(as_uuid=True), nullable=False),
        sa.Column('workspace_id', sa.Uuid(as_uuid=True), nullable=False),
        sa.Column('user_id', sa.Uuid(as_uuid=True), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Float(), nullable=False),
        sa.Column('end_time', sa.Float(), nullable=False),
        sa.Column('speaker', sa.String(length=64), server_default='Speaker 1', nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('source_segment_ids', sa.JSON(), server_default='[]', nullable=False),
        sa.Column('content_hash', sa.String(length=64), nullable=False),
        sa.Column('embedding_model', sa.String(length=64), nullable=False),
        sa.Column('embedding', Vector(384), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['recording_id'], ['recordings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    with op.batch_alter_table('transcript_chunks', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_transcript_chunks_recording_id'), ['recording_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_transcript_chunks_workspace_id'), ['workspace_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_transcript_chunks_user_id'), ['user_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_transcript_chunks_start_time'), ['start_time'], unique=False)


def downgrade():
    with op.batch_alter_table('transcript_chunks', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_transcript_chunks_start_time'))
        batch_op.drop_index(batch_op.f('ix_transcript_chunks_user_id'))
        batch_op.drop_index(batch_op.f('ix_transcript_chunks_workspace_id'))
        batch_op.drop_index(batch_op.f('ix_transcript_chunks_recording_id'))

    op.drop_table('transcript_chunks')

    with op.batch_alter_table('recordings', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_recordings_index_status'))
        batch_op.drop_column('index_error')
        batch_op.drop_column('indexed_at')
        batch_op.drop_column('index_status')
