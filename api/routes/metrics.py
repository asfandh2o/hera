from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from db.session import get_db
from models.employee import Employee
from models.task import Task
from core.config import settings
from core.logging import get_logger

router = APIRouter(prefix="/metrics", tags=["metrics"])
logger = get_logger(__name__)


@router.get("/productivity")
async def get_productivity_metrics(
    api_key: str = Query(...),
    days: int = Query(7),
    db: AsyncSession = Depends(get_db),
):
    """Productivity metrics for ARGUS. API key auth."""
    if api_key != settings.SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    since = datetime.utcnow() - timedelta(days=days)

    employees = (await db.execute(
        select(Employee).where(Employee.status == "active")
    )).scalars().all()

    priority_multipliers = {
        "critical": 2.0, "high": 1.5,
        "medium": 1.0, "low": 0.75,
    }

    results = []
    for emp in employees:
        tasks = (await db.execute(
            select(Task).where(
                Task.assigned_to == emp.id,
                Task.created_at >= since,
            )
        )).scalars().all()

        completed = [t for t in tasks if t.status == "done"]
        total = len(tasks)
        completed_count = len(completed)

        on_time = 0
        has_deadline_count = 0
        priority_weighted = 0.0

        for t in completed:
            mult = priority_multipliers.get(t.priority, 1.0)
            priority_weighted += mult

            if t.deadline:
                has_deadline_count += 1
                if t.updated_at and t.updated_at <= t.deadline:
                    on_time += 1

        results.append({
            "employee_id": str(emp.id),
            "employee_email": emp.email,
            "employee_name": emp.name,
            "employee_role": emp.role,
            "period_days": days,
            "tasks_total": total,
            "tasks_completed": completed_count,
            "on_time_completions": on_time,
            "tasks_with_deadline": has_deadline_count,
            "priority_weighted_completed": priority_weighted,
        })

    logger.info("productivity_metrics_served", employee_count=len(results))
    return {"metrics": results, "collected_at": datetime.utcnow().isoformat()}
