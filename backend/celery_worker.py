"""Celery Worker CLI Entry Point.

Usage:
    celery -A celery_worker.celery worker --loglevel=info --pool=threads --concurrency=2
"""

from app import create_app
from app.jobs.celery_app import make_celery
import app.jobs.tasks  # noqa: F401 - ensures tasks are discovered

app = create_app()
celery = make_celery(app)

if __name__ == "__main__":
    celery.start()
