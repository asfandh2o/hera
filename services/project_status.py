from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.task import Task
from models.prompt import Prompt
from models.employee import Employee


def compute_project_status(tasks: list) -> dict:
    """Compute project status from task objects. Pure function, no DB access."""
    if not tasks:
        return {
            "status": "not_started",
            "total_tasks": 0,
            "done_tasks": 0,
            "in_progress_tasks": 0,
            "overdue_tasks": 0,
            "progress_pct": 0,
        }

    now = datetime.utcnow()
    total = len(tasks)
    done = 0
    in_progress = 0
    overdue = 0

    for t in tasks:
        status = t.status if hasattr(t, "status") else t.get("status")
        deadline = t.deadline if hasattr(t, "deadline") else t.get("deadline")

        if status == "done":
            done += 1
        elif status == "in_progress":
            in_progress += 1

        if deadline and status != "done":
            dl = deadline if isinstance(deadline, datetime) else datetime.fromisoformat(str(deadline))
            if dl < now:
                overdue += 1

    if done == total:
        computed = "completed"
    elif overdue > 0:
        computed = "behind_schedule"
    elif in_progress > 0 or done > 0:
        computed = "in_progress"
    else:
        computed = "not_started"

    return {
        "status": computed,
        "total_tasks": total,
        "done_tasks": done,
        "in_progress_tasks": in_progress,
        "overdue_tasks": overdue,
        "progress_pct": round((done / total) * 100, 1) if total > 0 else 0,
    }


async def get_project_summary(db: AsyncSession, prompt_id) -> dict | None:
    """Get full project summary including computed status and team members."""
    result = await db.execute(select(Prompt).where(Prompt.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        return None

    task_result = await db.execute(select(Task).where(Task.prompt_id == prompt_id))
    tasks = task_result.scalars().all()
    status_info = compute_project_status(tasks)

    employee_ids = list({t.assigned_to for t in tasks if t.assigned_to})
    team_members = []
    if employee_ids:
        emp_result = await db.execute(select(Employee).where(Employee.id.in_(employee_ids)))
        team_members = [
            {"id": str(e.id), "name": e.name, "role": e.role}
            for e in emp_result.scalars().all()
        ]

    return {
        "id": str(prompt.id),
        "project_name": prompt.project_name or "Untitled Project",
        "raw_text": prompt.raw_text,
        "created_by": prompt.created_by,
        "created_at": prompt.created_at,
        "prompt_status": prompt.status,
        "llm_response": prompt.llm_response,
        **status_info,
        "team_members": team_members,
    }
