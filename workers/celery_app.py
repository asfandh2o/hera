from celery import Celery
from celery.schedules import crontab
from core.config import settings

celery_app = Celery(
    "hera",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["workers.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=10 * 60,
    task_soft_time_limit=8 * 60,
)

celery_app.conf.beat_schedule = {
    "check-overdue-and-remind": {
        "task": "workers.tasks.check_overdue_and_remind",
        "schedule": crontab(minute="0", hour="*/6"),  # Every 6 hours
    },
}

if __name__ == "__main__":
    celery_app.start()
