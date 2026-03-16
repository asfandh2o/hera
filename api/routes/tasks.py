from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete, distinct
from typing import List, Optional, Set
from uuid import UUID
from datetime import datetime, timedelta
import httpx
from db.session import get_db
from models.task import Task
from models.task_dependency import TaskDependency
from models.employee import Employee
from models.prompt import Prompt
from schemas.task import TaskResponse, TaskStatusUpdate, TaskUpdate
from api.deps import get_current_user, require_admin
from core.logging import get_logger
from core.config import settings

router = APIRouter(prefix="/tasks", tags=["tasks"])
logger = get_logger(__name__)


# ── Dependency helpers ──────────────────────────────────────────────

async def _get_dependency_map(db: AsyncSession, task_ids: list) -> dict:
    """Return {task_id: [depends_on_id, ...]} for given task IDs."""
    if not task_ids:
        return {}
    result = await db.execute(
        select(TaskDependency).where(TaskDependency.task_id.in_(task_ids))
    )
    deps = result.scalars().all()
    dep_map = {}
    for d in deps:
        dep_map.setdefault(str(d.task_id), []).append(str(d.depends_on_id))
    return dep_map


async def _is_task_blocked(db: AsyncSession, task_id) -> tuple:
    """Check if a task is blocked by incomplete dependencies.
    Returns (is_blocked: bool, blocker_titles: list[str])."""
    result = await db.execute(
        select(TaskDependency).where(TaskDependency.task_id == task_id)
    )
    deps = result.scalars().all()
    if not deps:
        return False, []

    dep_ids = [d.depends_on_id for d in deps]
    task_result = await db.execute(
        select(Task).where(Task.id.in_(dep_ids))
    )
    blocker_tasks = task_result.scalars().all()
    blockers = [t.title for t in blocker_tasks if t.status != "done"]
    return len(blockers) > 0, blockers


async def _check_circular(db: AsyncSession, task_id: str, new_dep_id: str) -> bool:
    """Return True if adding new_dep_id as dependency of task_id would create a cycle."""
    visited: Set[str] = set()

    async def dfs(current_id: str) -> bool:
        if current_id == task_id:
            return True
        if current_id in visited:
            return False
        visited.add(current_id)
        result = await db.execute(
            select(TaskDependency).where(TaskDependency.task_id == current_id)
        )
        for dep in result.scalars().all():
            if await dfs(str(dep.depends_on_id)):
                return True
        return False

    return await dfs(new_dep_id)


async def _enrich_responses(db: AsyncSession, tasks: list, name_map: dict) -> List[TaskResponse]:
    """Build TaskResponse list with dependency, block info, and project names."""
    task_ids = [t.id for t in tasks]
    dep_map = await _get_dependency_map(db, task_ids)

    # Collect all dependency IDs to check their statuses
    all_dep_ids = set()
    for ids in dep_map.values():
        all_dep_ids.update(ids)

    dep_status_map = {}
    if all_dep_ids:
        dep_result = await db.execute(
            select(Task.id, Task.status).where(Task.id.in_(all_dep_ids))
        )
        for row in dep_result:
            dep_status_map[str(row[0])] = row[1]

    # Look up project names from prompts
    prompt_ids = list({t.prompt_id for t in tasks if t.prompt_id})
    project_name_map = {}
    if prompt_ids:
        prompt_result = await db.execute(
            select(Prompt.id, Prompt.project_name).where(Prompt.id.in_(prompt_ids))
        )
        for row in prompt_result:
            project_name_map[str(row[0])] = row[1]

    responses = []
    for t in tasks:
        tr = TaskResponse.model_validate(t)
        if t.assigned_to:
            tr.assigned_to_name = name_map.get(str(t.assigned_to))
        if t.prompt_id:
            tr.project_name = project_name_map.get(str(t.prompt_id))

        blocked_ids = dep_map.get(str(t.id), [])
        tr.blocked_by_ids = [UUID(bid) for bid in blocked_ids]
        tr.is_blocked = any(
            dep_status_map.get(bid) != "done" for bid in blocked_ids
        )
        responses.append(tr)

    return responses


# ── List tasks ──────────────────────────────────────────────────────

@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    status: Optional[str] = None,
    assigned_to: Optional[str] = None,
    prompt_id: Optional[UUID] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List tasks. Admin sees all, employee sees only their own."""
    query = select(Task)

    if current_user["role"] == "employee":
        query = query.where(Task.assigned_to == current_user["id"])
    elif assigned_to:
        query = query.where(Task.assigned_to == assigned_to)

    if prompt_id:
        query = query.where(Task.prompt_id == prompt_id)

    if status:
        query = query.where(Task.status == status)

    query = query.order_by(
        Task.priority.desc(),
        desc(Task.created_at),
    ).limit(limit)

    result = await db.execute(query)
    tasks = result.scalars().all()

    employee_ids = [t.assigned_to for t in tasks if t.assigned_to]
    name_map = {}
    if employee_ids:
        emp_result = await db.execute(
            select(Employee).where(Employee.id.in_(employee_ids))
        )
        for emp in emp_result.scalars().all():
            name_map[str(emp.id)] = emp.name

    return await _enrich_responses(db, tasks, name_map)


# ── Employee's projects ─────────────────────────────────────────────

@router.get("/my-projects")
async def get_my_projects(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Get distinct projects the current employee has tasks in."""
    if current_user["role"] != "employee":
        raise HTTPException(status_code=403, detail="Employee-only endpoint")

    result = await db.execute(
        select(distinct(Prompt.id), Prompt.project_name)
        .join(Task, Task.prompt_id == Prompt.id)
        .where(Task.assigned_to == current_user["id"])
        .order_by(Prompt.project_name)
    )
    return [
        {"id": str(row[0]), "project_name": row[1] or "Untitled Project"}
        for row in result.all()
    ]


# ── Timeline / Gantt ────────────────────────────────────────────────

@router.get("/timeline")
async def get_timeline(
    prompt_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Get tasks grouped by employee for Gantt chart view."""
    emp_result = await db.execute(select(Employee).where(Employee.status == "active"))
    employees = emp_result.scalars().all()

    task_query = select(Task).order_by(Task.created_at)
    if prompt_id:
        task_query = task_query.where(Task.prompt_id == prompt_id)
    task_result = await db.execute(task_query)
    tasks = task_result.scalars().all()

    # Build dependency map for all tasks
    all_task_ids = [t.id for t in tasks]
    dep_map = await _get_dependency_map(db, all_task_ids)
    all_dep_ids = set()
    for ids in dep_map.values():
        all_dep_ids.update(ids)
    dep_status_map = {}
    if all_dep_ids:
        dep_result = await db.execute(
            select(Task.id, Task.status).where(Task.id.in_(all_dep_ids))
        )
        for row in dep_result:
            dep_status_map[str(row[0])] = row[1]

    emp_map = {str(e.id): e for e in employees}
    grouped = {}
    unassigned = []

    for t in tasks:
        key = str(t.assigned_to) if t.assigned_to else None
        if key and key in emp_map:
            if key not in grouped:
                grouped[key] = []
            grouped[key].append(t)
        else:
            unassigned.append(t)

    def _task_dict(t):
        blocked_ids = dep_map.get(str(t.id), [])
        is_blocked = any(dep_status_map.get(bid) != "done" for bid in blocked_ids)
        return {
            "id": str(t.id),
            "title": t.title,
            "description": t.description,
            "priority": t.priority,
            "status": t.status,
            "start_date": t.start_date.isoformat() if t.start_date else t.created_at.isoformat(),
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "estimated_hours": t.estimated_hours,
            "skills_required": t.skills_required or [],
            "blocked_by_ids": blocked_ids,
            "is_blocked": is_blocked,
        }

    rows = []
    for emp_id, emp_tasks in grouped.items():
        emp = emp_map[emp_id]
        rows.append({
            "employee": {"id": str(emp.id), "name": emp.name, "role": emp.role},
            "tasks": [_task_dict(t) for t in emp_tasks],
        })

    if unassigned:
        rows.append({
            "employee": {"id": None, "name": "Unassigned", "role": ""},
            "tasks": [_task_dict(t) for t in unassigned],
        })

    return rows


# ── Approaching deadlines (for ECHO Celery) ────────────────────────

@router.get("/approaching-deadlines")
async def get_approaching_deadlines(
    hours: int = 24,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Get tasks with deadlines approaching within N hours."""
    now = datetime.utcnow()
    cutoff = now + timedelta(hours=hours)

    result = await db.execute(
        select(Task).where(
            Task.deadline.isnot(None),
            Task.deadline <= cutoff,
            Task.status.notin_(["done"]),
        ).order_by(Task.deadline)
    )
    tasks = result.scalars().all()

    items = []
    for t in tasks:
        emp_email = None
        if t.assigned_to:
            emp_r = await db.execute(select(Employee).where(Employee.id == t.assigned_to))
            emp = emp_r.scalar_one_or_none()
            if emp:
                emp_email = emp.email
        items.append({
            "task_id": str(t.id),
            "title": t.title,
            "deadline": t.deadline.isoformat(),
            "priority": t.priority,
            "status": t.status,
            "is_overdue": t.deadline < now,
            "assigned_to_email": emp_email,
            "prompt_id": str(t.prompt_id) if t.prompt_id else None,
        })

    return items


# ── Update task status ──────────────────────────────────────────────

@router.put("/{task_id}/status", response_model=TaskResponse)
async def update_task_status(
    task_id: UUID,
    body: TaskStatusUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update task status. Employees can only update their own tasks."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if current_user["role"] == "employee" and str(task.assigned_to) != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your task")

    valid_statuses = ["pending", "assigned", "in_progress", "done"]
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid_statuses}")

    # Block transition to in_progress if dependencies are not met
    if body.status == "in_progress":
        is_blocked, blockers = await _is_task_blocked(db, task_id)
        if is_blocked:
            raise HTTPException(
                status_code=400,
                detail=f"Task is blocked by incomplete dependencies: {', '.join(blockers)}"
            )

    old_status = task.status
    task.status = body.status
    await db.commit()
    await db.refresh(task)

    logger.info("task_status_updated", task_id=str(task_id), new_status=body.status)

    # Notify ECHO of status change
    if old_status != body.status and task.assigned_to and settings.ECHO_API_KEY:
        emp_result = await db.execute(select(Employee).where(Employee.id == task.assigned_to))
        emp = emp_result.scalar_one_or_none()
        if emp:
            background_tasks.add_task(
                _notify_echo_status_update,
                emp.email,
                str(task_id),
                body.status,
                task.deadline.isoformat() if task.deadline else None,
            )

    tr = TaskResponse.model_validate(task)
    if task.assigned_to:
        emp_result2 = await db.execute(select(Employee).where(Employee.id == task.assigned_to))
        emp2 = emp_result2.scalar_one_or_none()
        if emp2:
            tr.assigned_to_name = emp2.name

    # Enrich with dependency info
    dep_map = await _get_dependency_map(db, [task.id])
    blocked_ids = dep_map.get(str(task.id), [])
    tr.blocked_by_ids = [UUID(bid) for bid in blocked_ids]
    tr.is_blocked = False  # We just verified it's not blocked
    return tr


# ── Full task update (admin) ────────────────────────────────────────

@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    body: TaskUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Full task update (admin only)."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    old_assigned_to = str(task.assigned_to) if task.assigned_to else None
    old_status = task.status

    # Handle dependency updates separately
    new_blocked_by = body.blocked_by_ids
    update_data = body.model_dump(exclude_none=True)
    update_data.pop("blocked_by_ids", None)

    for field, value in update_data.items():
        # Strip timezone info from datetimes (DB columns are naive)
        if isinstance(value, datetime) and value.tzinfo is not None:
            value = value.replace(tzinfo=None)
        setattr(task, field, value)

    # Update dependencies if provided
    if new_blocked_by is not None:
        # Validate no circular dependencies
        for dep_id in new_blocked_by:
            if str(dep_id) == str(task_id):
                raise HTTPException(status_code=400, detail="A task cannot depend on itself")
            if await _check_circular(db, str(task_id), str(dep_id)):
                raise HTTPException(status_code=400, detail=f"Adding dependency {dep_id} would create a cycle")

        # Delete existing and insert new
        await db.execute(
            delete(TaskDependency).where(TaskDependency.task_id == task_id)
        )
        for dep_id in new_blocked_by:
            db.add(TaskDependency(task_id=task_id, depends_on_id=dep_id))

    await db.commit()
    await db.refresh(task)

    # Notify ECHO of status change (from full update)
    new_status = update_data.get("status")
    if new_status and new_status != old_status and task.assigned_to and settings.ECHO_API_KEY:
        emp_check = await db.execute(select(Employee).where(Employee.id == task.assigned_to))
        emp_for_status = emp_check.scalar_one_or_none()
        if emp_for_status:
            background_tasks.add_task(
                _notify_echo_status_update,
                emp_for_status.email,
                str(task_id),
                new_status,
                task.deadline.isoformat() if task.deadline else None,
            )

    # Notify ECHO if assignment changed to a new person
    new_assigned_to = str(task.assigned_to) if task.assigned_to else None
    if new_assigned_to and new_assigned_to != old_assigned_to and settings.ECHO_API_KEY:
        emp_result = await db.execute(select(Employee).where(Employee.id == task.assigned_to))
        emp = emp_result.scalar_one_or_none()
        if emp:
            # Get project name if linked to a prompt
            project_name = "HERA"
            if task.prompt_id:
                prompt_result = await db.execute(select(Prompt).where(Prompt.id == task.prompt_id))
                prompt = prompt_result.scalar_one_or_none()
                if prompt and prompt.project_name:
                    project_name = prompt.project_name

            background_tasks.add_task(
                _notify_echo_single,
                emp.email,
                task.title,
                project_name,
                str(task.id),
                task.priority or "normal",
                task.deadline.isoformat() if task.deadline else None,
            )

    tr = TaskResponse.model_validate(task)
    if task.assigned_to:
        emp_result2 = await db.execute(select(Employee).where(Employee.id == task.assigned_to))
        emp2 = emp_result2.scalar_one_or_none()
        if emp2:
            tr.assigned_to_name = emp2.name

    # Enrich with dependency info
    dep_map = await _get_dependency_map(db, [task.id])
    blocked_ids = dep_map.get(str(task.id), [])
    tr.blocked_by_ids = [UUID(bid) for bid in blocked_ids]
    if blocked_ids:
        all_dep_ids = set(blocked_ids)
        dep_result = await db.execute(
            select(Task.id, Task.status).where(Task.id.in_(all_dep_ids))
        )
        dep_status_map = {str(row[0]): row[1] for row in dep_result}
        tr.is_blocked = any(dep_status_map.get(bid) != "done" for bid in blocked_ids)
    else:
        tr.is_blocked = False

    return tr


# ── ECHO notification helpers ───────────────────────────────────────

async def _notify_echo_single(email: str, task_title: str, project_name: str, task_id: str = None, priority: str = "normal", deadline: str = None):
    """Send a single task assignment notification to ECHO."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.ECHO_API_URL}/notifications/webhook",
                json={
                    "api_key": settings.ECHO_API_KEY,
                    "notifications": [{
                        "email": email,
                        "type": "task_assigned",
                        "source": "hera",
                        "title": f"You've been assigned a new task in {project_name}",
                        "message": task_title,
                        "metadata": {
                            "project_name": project_name,
                            "task_id": task_id,
                            "priority": priority,
                            "deadline": deadline,
                        },
                    }],
                },
            )
            if resp.status_code == 200:
                logger.info("echo_notification_sent", email=email, task=task_title)
            else:
                logger.warning("echo_notification_failed", status=resp.status_code)
    except Exception as e:
        logger.warning("echo_notification_error", error=str(e))


async def _notify_echo_status_update(email: str, hera_task_id: str, new_status: str, deadline: str = None):
    """Notify ECHO when a HERA task status changes."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.ECHO_API_URL}/tasks/sync",
                json={
                    "api_key": settings.ECHO_API_KEY,
                    "hera_task_id": hera_task_id,
                    "email": email,
                    "status": new_status,
                    "deadline": deadline,
                },
            )
            if resp.status_code == 200:
                logger.info("echo_task_sync_sent", hera_task_id=hera_task_id, status=new_status)
            else:
                logger.warning("echo_task_sync_failed", status=resp.status_code)
    except Exception as e:
        logger.warning("echo_task_sync_error", error=str(e))


# ── ECHO → HERA sync webhook ───────────────────────────────────────

@router.post("/sync", summary="Receive task status updates from ECHO")
async def receive_echo_sync(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Webhook for ECHO to sync task status changes back to HERA."""
    if body.get("api_key") != settings.SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    hera_task_id = body.get("hera_task_id")
    new_status = body.get("status")
    if not hera_task_id or not new_status:
        raise HTTPException(status_code=400, detail="Missing hera_task_id or status")

    # Map ECHO statuses to HERA statuses
    status_map = {
        "pending": "pending",
        "in_progress": "in_progress",
        "completed": "done",
        "dismissed": "done",
    }
    hera_status = status_map.get(new_status, new_status)

    valid_statuses = ["pending", "assigned", "in_progress", "done"]
    if hera_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status: {hera_status}")

    result = await db.execute(select(Task).where(Task.id == hera_task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Check dependency blocking for in_progress transition
    if hera_status == "in_progress":
        is_blocked, blockers = await _is_task_blocked(db, hera_task_id)
        if is_blocked:
            return {"status": "blocked", "blockers": blockers}

    task.status = hera_status
    await db.commit()
    logger.info("hera_task_synced_from_echo", task_id=hera_task_id, status=hera_status)
    return {"status": "ok", "hera_status": hera_status}


# ── Delete task ─────────────────────────────────────────────────────

@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    """Delete a task (admin only)."""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()
    logger.info("task_deleted", task_id=str(task_id))
