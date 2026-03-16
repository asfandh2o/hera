"""
HERA Celery worker tasks.

Periodic tasks:
- check_overdue_and_remind: Every 6 hours, checks for overdue tasks,
  shifts downstream task dates, and sends daily reminders to ECHO.
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from workers.celery_app import celery_app
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from models.task import Task
from models.employee import Employee
from models.prompt import Prompt
from services.scheduler import shift_overdue_downstream
from core.config import settings
from core.logging import get_logger
from datetime import datetime
import asyncio
import httpx

logger = get_logger(__name__)


def _create_session_factory():
    """Create a fresh engine and session factory for each task."""
    engine = create_async_engine(
        settings.DATABASE_URL,
        pool_size=5,
        max_overflow=5,
        pool_pre_ping=True,
    )
    return async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )


@celery_app.task(name="workers.tasks.check_overdue_and_remind")
def check_overdue_and_remind():
    """Check for overdue tasks, shift downstream dates, and send reminders to ECHO."""
    asyncio.run(_check_overdue_and_remind_async())


async def _check_overdue_and_remind_async():
    SessionLocal = _create_session_factory()
    async with SessionLocal() as db:
        try:
            now = datetime.utcnow()

            # Find all overdue tasks (deadline passed, not done)
            result = await db.execute(
                select(Task).where(
                    Task.deadline.isnot(None),
                    Task.deadline < now,
                    Task.status.notin_(["done"]),
                )
            )
            overdue_tasks = result.scalars().all()

            if not overdue_tasks:
                logger.info("overdue_check_no_tasks")
                return

            logger.info("overdue_tasks_found", count=len(overdue_tasks))

            notifications = []

            for task in overdue_tasks:
                # Shift downstream task dates
                try:
                    shifted = await shift_overdue_downstream(db, str(task.id))
                    if shifted:
                        logger.info("shifted_downstream", task_id=str(task.id), shifted=len(shifted))
                except Exception as e:
                    logger.warning("shift_failed", task_id=str(task.id), error=str(e))

                # Build ECHO notification for the assigned employee
                if task.assigned_to:
                    emp_result = await db.execute(
                        select(Employee).where(Employee.id == task.assigned_to)
                    )
                    emp = emp_result.scalar_one_or_none()
                    if emp:
                        # Get project name
                        project_name = "HERA"
                        if task.prompt_id:
                            prompt_result = await db.execute(
                                select(Prompt).where(Prompt.id == task.prompt_id)
                            )
                            prompt = prompt_result.scalar_one_or_none()
                            if prompt and prompt.project_name:
                                project_name = prompt.project_name

                        days_overdue = max(1, int((now - task.deadline).total_seconds() / 86400))
                        deadline_str = task.deadline.strftime("%b %d, %Y")

                        notifications.append({
                            "email": emp.email,
                            "type": "deadline_overdue",
                            "source": "hera",
                            "title": f"Overdue: {task.title} ({days_overdue}d late)",
                            "message": f"This task was due {deadline_str} in {project_name}. Please complete it or update your manager.",
                            "metadata": {
                                "task_id": str(task.id),
                                "project_name": project_name,
                                "deadline": task.deadline.isoformat(),
                                "days_overdue": days_overdue,
                                "priority": task.priority,
                                "is_overdue": True,
                            },
                        })

            # Send all notifications to ECHO in one batch
            if notifications and settings.ECHO_API_KEY:
                try:
                    async with httpx.AsyncClient(timeout=15.0) as client:
                        resp = await client.post(
                            f"{settings.ECHO_API_URL}/notifications/webhook",
                            json={
                                "api_key": settings.ECHO_API_KEY,
                                "notifications": notifications,
                            },
                        )
                        if resp.status_code == 200:
                            logger.info("overdue_reminders_sent", count=len(notifications))
                        else:
                            logger.warning("overdue_reminders_failed", status=resp.status_code)
                except Exception as e:
                    logger.warning("overdue_reminders_error", error=str(e))

            logger.info(
                "overdue_check_complete",
                overdue_count=len(overdue_tasks),
                reminders_sent=len(notifications),
            )

        except Exception as e:
            logger.error("overdue_check_failed", error=str(e))
