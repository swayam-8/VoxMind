"""Pytest fixtures for VoxMind backend test suite."""

import pytest
from app import create_app
from app.extensions import db


@pytest.fixture(scope="session")
def app():
    """Create test application configured for testing."""
    test_app = create_app("testing")

    with test_app.app_context():
        db.create_all()
        yield test_app
        db.drop_all()


@pytest.fixture
def client(app):
    """Test client for issuing requests."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Test CLI runner."""
    return app.test_cli_runner()
