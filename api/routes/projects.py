from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List
from uuid import UUID
from db.session import get_db
from models.prompt import Prompt
from models.task import Task
from models.employee import Employee
from schemas.project import ProjectSummary, ProjectDetail, ProjectDashboardStats
from api.deps import get_current_user, require_admin
from services.project_status import compute_project_status, get_project_summary

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/", response_model=List[ProjectSummary])
async def list_projects(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List confirmed projects with computed status."""
    result = await db.execute(
        select(Prompt)
        .where(Prompt.status == "completed")
        .order_by(desc(Prompt.created_at))
        .limit(limit)
    )
    prompts = result.scalars().all()

    # Employees only see projects they're assigned to
    if current_user.get("role") == "employee":
        emp_id = current_user["id"]
        task_result = await db.execute(
            select(Task.prompt_id).where(Task.assigned_to == emp_id).distinct()
        )
        my_prompt_ids = {str(row[0]) for row in task_result.all() if row[0]}
        prompts = [p for p in prompts if str(p.id) in my_prompt_ids]

    summaries = []
    for prompt in prompts:
        task_result = await db.execute(select(Task).where(Task.prompt_id == prompt.id))
        tasks = task_result.scalars().all()
        status_info = compute_project_status(tasks)

        employee_ids = list({t.assigned_to for t in tasks if t.assigned_to})
        team_members = []
        if employee_ids:
            emp_result = await db.execute(
                select(Employee).where(Employee.id.in_(employee_ids))
            )
            team_members = [
                {"id": str(e.id), "name": e.name, "role": e.role}
                for e in emp_result.scalars().all()
            ]

        summaries.append(ProjectSummary(
            id=prompt.id,
            project_name=prompt.project_name or "Untitled Project",
            created_by=prompt.created_by,
            created_at=prompt.created_at,
            team_members=team_members,
            **status_info,
        ))

    return summaries


@router.get("/stats", response_model=ProjectDashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    """Aggregate project stats for dashboard header."""
    result = await db.execute(
        select(Prompt).where(Prompt.status == "completed")
    )
    prompts = result.scalars().all()

    stats = {"total_projects": 0, "in_progress": 0,
             "behind_schedule": 0, "completed": 0, "not_started": 0}

    for prompt in prompts:
        task_result = await db.execute(select(Task).where(Task.prompt_id == prompt.id))
        tasks = task_result.scalars().all()
        status_info = compute_project_status(tasks)
        stats["total_projects"] += 1
        s = status_info["status"]
        if s in stats:
            stats[s] += 1

    return ProjectDashboardStats(**stats)


@router.get("/{project_id}", response_model=ProjectDetail)
async def get_project_detail(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Full project detail with task breakdowns."""
    summary = await get_project_summary(db, project_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Project not found")

    if current_user.get("role") == "employee":
        task_check = await db.execute(
            select(Task).where(
                Task.prompt_id == project_id,
                Task.assigned_to == current_user["id"]
            ).limit(1)
        )
        if not task_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not your project")

    task_result = await db.execute(select(Task).where(Task.prompt_id == project_id))
    tasks = task_result.scalars().all()

    by_status = {}
    by_priority = {}
    for t in tasks:
        by_status[t.status] = by_status.get(t.status, 0) + 1
        by_priority[t.priority] = by_priority.get(t.priority, 0) + 1

    return ProjectDetail(
        id=summary["id"],
        project_name=summary["project_name"],
        raw_text=summary["raw_text"],
        created_by=summary["created_by"],
        created_at=summary["created_at"],
        prompt_status=summary["prompt_status"],
        llm_response=summary.get("llm_response"),
        status=summary["status"],
        total_tasks=summary["total_tasks"],
        done_tasks=summary["done_tasks"],
        in_progress_tasks=summary["in_progress_tasks"],
        overdue_tasks=summary["overdue_tasks"],
        progress_pct=summary["progress_pct"],
        team_members=summary["team_members"],
        tasks_by_status=by_status,
        tasks_by_priority=by_priority,
    )
