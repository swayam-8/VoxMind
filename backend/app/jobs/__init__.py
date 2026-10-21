"""Background jobs package."""

from app.jobs.celery_app import make_celery

__all__ = ["make_celery"]
