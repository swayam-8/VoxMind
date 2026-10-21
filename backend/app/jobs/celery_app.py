"""Celery Application Initialization and Factory.

Configures bounded worker concurrency, prefetch limits, task serialization,
and Flask application context propagation for asynchronous background processing.
"""

from celery import Celery
from flask import Flask


def make_celery(app: Flask) -> Celery:
    """Create and configure a Celery application bound to Flask context."""
    celery_app = Celery(
        app.import_name,
        broker=app.config["CELERY_BROKER_URL"],
        backend=app.config["CELERY_RESULT_BACKEND"],
        include=["app.jobs.tasks"],
    )

    celery_app.conf.update(
        task_always_eager=app.config.get("CELERY_TASK_ALWAYS_EAGER", False),
        task_eager_propagates=True,
        task_serializer="json",
        accept_content=["json"],
        result_serializer="json",
        timezone="UTC",
        enable_utc=True,
        task_track_started=True,
        worker_prefetch_multiplier=app.config.get("CELERY_WORKER_PREFETCH_MULTIPLIER", 1),
        task_time_limit=app.config.get("CELERY_TASK_TIME_LIMIT", 1800),
        task_soft_time_limit=app.config.get("CELERY_TASK_SOFT_TIME_LIMIT", 1500),
        worker_concurrency=app.config.get("CELERY_WORKER_CONCURRENCY", 2),
    )

    class ContextTask(celery_app.Task):
        """Execute tasks within Flask application context."""

        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery_app.Task = ContextTask
    celery_app.set_default()
    app.extensions["celery"] = celery_app
    return celery_app
