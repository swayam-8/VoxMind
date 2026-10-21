"""add hnsw index and ai usage fields

Revision ID: c7d8e9f0a1b2
Revises: a1b2c3d4e5f6
Create Date: 2026-10-22 00:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c7d8e9f0a1b2'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()

    # 1. Add HNSW cosine index for pgvector on PostgreSQL
    if bind and bind.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
        op.execute(
            "CREATE INDEX IF NOT EXISTS ix_transcript_chunks_embedding_hnsw "
            "ON transcript_chunks "
            "USING hnsw (embedding vector_cosine_ops);"
        )

    # 2. Add AI token and resource usage tracking fields to api_usage_records
    with op.batch_alter_table('api_usage_records', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('resource_type', sa.String(length=32), server_default='api_request', nullable=False)
        )
        batch_op.add_column(sa.Column('model_name', sa.String(length=64), nullable=True))
        batch_op.add_column(
            sa.Column('prompt_tokens', sa.Integer(), server_default='0', nullable=False)
        )
        batch_op.add_column(
            sa.Column('completion_tokens', sa.Integer(), server_default='0', nullable=False)
        )
        batch_op.add_column(
            sa.Column('total_tokens', sa.Integer(), server_default='0', nullable=False)
        )
        batch_op.add_column(
            sa.Column('duration_seconds', sa.Float(), server_default='0.0', nullable=False)
        )
        batch_op.create_index(
            batch_op.f('ix_api_usage_records_resource_type'), ['resource_type'], unique=False
        )


def downgrade():
    with op.batch_alter_table('api_usage_records', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_api_usage_records_resource_type'))
        batch_op.drop_column('duration_seconds')
        batch_op.drop_column('total_tokens')
        batch_op.drop_column('completion_tokens')
        batch_op.drop_column('prompt_tokens')
        batch_op.drop_column('model_name')
        batch_op.drop_column('resource_type')

    bind = op.get_bind()
    if bind and bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_transcript_chunks_embedding_hnsw;")
