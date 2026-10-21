"""VoxMind Flask Application Factory."""

import os
from flask import Flask
from app.config import get_config
from app.extensions import db, migrate, cors
from app.jobs.celery_app import make_celery
from app.api.v1 import api_v1
from app.api.v1.errors import register_error_handlers


def create_app(config_name: str | None = None) -> Flask:
    """Create and configure the Flask application instance."""
    app = Flask(__name__)

    # Load configuration
    cfg = get_config(config_name)
    app.config.from_object(cfg)

    # Ensure storage paths exist
    upload_dir = app.config.get("UPLOAD_DIR")
    if upload_dir:
        os.makedirs(upload_dir, exist_ok=True)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    make_celery(app)
    cors.init_app(
        app,
        resources={r"/api/*": {"origins": app.config.get("CORS_ORIGINS", "*")}},
        supports_credentials=True,
    )

    # Register blueprints
    app.register_blueprint(api_v1)

    # Register error handlers
    register_error_handlers(app)

    return app
