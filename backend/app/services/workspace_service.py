"""Workspace & Tenant Resolution Service."""

from typing import Tuple
from app.extensions import db
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMembership


class WorkspaceService:
    """Provides workspace isolation resolution and default development tenant seeding."""

    @staticmethod
    def get_or_create_default_context() -> Tuple[User, Workspace]:
        """Ensure a default user and workspace exists for development and testing."""
        # 1. Ensure user
        user = db.session.query(User).filter_by(email="admin@voxmind.internal").first()
        if not user:
            user = User(
                email="admin@voxmind.internal",
                full_name="VoxMind Admin",
                is_active=True,
                is_superuser=True,
            )
            user.set_password("VoxMind2026Secure!")
            db.session.add(user)
            db.session.flush()

        # 2. Ensure workspace
        workspace = db.session.query(Workspace).filter_by(slug="default").first()
        if not workspace:
            workspace = Workspace(
                name="Default Workspace",
                slug="default",
                created_by_user_id=user.id,
            )
            db.session.add(workspace)
            db.session.flush()

            # Ensure membership
            membership = WorkspaceMembership(
                workspace_id=workspace.id,
                user_id=user.id,
                role="owner",
            )
            db.session.add(membership)

        db.session.commit()
        return user, workspace
