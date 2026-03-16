from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, distinct
from typing import List, Optional
from uuid import UUID
import httpx
from db.session import get_db
from models.prompt import Prompt
from models.task import Task
from models.employee import Employee
from schemas.task import PromptRequest, PromptResponse, TaskResponse, TaskCreate, ConfirmAssignments
from api.deps import require_admin
from services.orchestrator import Orchestrator
from services.scheduler import auto_schedule_tasks
from services.document_extractor import extract_text_from_file, SUPPORTED_EXTENSIONS, MAX_TEXT_LENGTH
from core.logging import get_logger
from core.config import settings

router = APIRouter(prefix="/prompts", tags=["prompts"])
logger = get_logger(__name__)


@router.post("/", response_model=PromptResponse)
async def create_prompt(
    body: PromptRequest,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Submit a prompt — HERA breaks it down and suggests allocations for review."""
    if not body.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    orchestrator = Orchestrator(db)

    try:
        prompt = await orchestrator.process_prompt(
            raw_text=body.prompt.strip(),
            created_by=admin["email"],
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("prompt_processing_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to process prompt")

    # Fetch tasks with suggestions
    return await _build_prompt_response(db, prompt)


@router.post("/upload", response_model=PromptResponse)
async def create_prompt_with_files(
    prompt: str = Form(...),
    files: List[UploadFile] = File(default=[]),
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Submit a prompt with optional document uploads for context."""
    if not prompt.strip() and not files:
        raise HTTPException(status_code=400, detail="Provide a prompt or upload documents")

    # Extract text from uploaded files
    doc_texts = []
    file_names = []
    for f in files:
        ext = ("." + f.filename.rsplit(".", 1)[-1]).lower() if "." in f.filename else ""
        if ext not in SUPPORTED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {f.filename}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}"
            )
        file_bytes = await f.read()
        text = extract_text_from_file(f.filename, file_bytes)
        if text.strip():
            doc_texts.append(f"--- Document: {f.filename} ---\n{text}")
            file_names.append(f.filename)

    # Combine document text with prompt
    combined = prompt.strip()
    if doc_texts:
        doc_content = "\n\n".join(doc_texts)
        # Truncate if too long for LLM context
        if len(doc_content) > MAX_TEXT_LENGTH:
            doc_content = doc_content[:MAX_TEXT_LENGTH] + "\n\n[Document content truncated...]"
        combined = f"PROJECT DOCUMENTATION:\n{doc_content}\n\nDIRECTIVE:\n{combined}"

    logger.info("prompt_with_files", files=file_names, prompt_length=len(combined))

    orchestrator = Orchestrator(db)
    try:
        result = await orchestrator.process_prompt(
            raw_text=combined,
            created_by=admin["email"],
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("prompt_upload_processing_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to process prompt with documents")

    return await _build_prompt_response(db, result)


@router.post("/{prompt_id}/confirm", response_model=PromptResponse)
async def confirm_assignments(
    prompt_id: UUID,
    body: ConfirmAssignments,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Confirm task assignments after reviewing suggestions."""
    result = await db.execute(select(Prompt).where(Prompt.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    # Collect assigned employee IDs to notify
    assigned_employee_ids = set()

    # Apply each assignment
    for assignment in body.assignments:
        task_result = await db.execute(
            select(Task).where(Task.id == assignment.task_id, Task.prompt_id == prompt_id)
        )
        task = task_result.scalar_one_or_none()
        if not task:
            continue

        if assignment.employee_id:
            task.assigned_to = assignment.employee_id
            task.status = "assigned"
            assigned_employee_ids.add(assignment.employee_id)
        # If no employee_id, leave as pending (unassigned)

    prompt.status = "completed"
    await db.commit()
    await db.refresh(prompt)

    # Auto-schedule tasks based on dependencies and estimated_hours
    assigned_task_ids = []
    for assignment in body.assignments:
        if assignment.employee_id:
            assigned_task_ids.append(assignment.task_id)
    if assigned_task_ids:
        try:
            await auto_schedule_tasks(db, assigned_task_ids)
        except Exception as e:
            logger.warning("auto_schedule_failed", error=str(e))

    logger.info("assignments_confirmed", prompt_id=str(prompt_id), count=len(body.assignments))

    # Build notification data for ECHO
    if assigned_employee_ids and settings.ECHO_API_KEY:
        # Get employee emails and task details
        emp_result = await db.execute(
            select(Employee).where(Employee.id.in_(list(assigned_employee_ids)))
        )
        emp_map = {str(e.id): e for e in emp_result.scalars().all()}

        task_result = await db.execute(
            select(Task).where(Task.prompt_id == prompt_id, Task.status == "assigned")
        )
        assigned_tasks = task_result.scalars().all()

        project_name = prompt.project_name or "New Project"
        notifications = []
        for t in assigned_tasks:
            emp = emp_map.get(str(t.assigned_to))
            if not emp:
                continue
            notifications.append({
                "email": emp.email,
                "type": "task_assigned",
                "source": "hera",
                "title": f"You've been assigned a new task in {project_name}",
                "message": t.title,
                "metadata": {
                    "project_name": project_name,
                    "task_id": str(t.id),
                    "priority": t.priority or "normal",
                },
            })

        if notifications:
            background_tasks.add_task(
                _notify_echo, notifications
            )

    return await _build_prompt_response(db, prompt)


async def _notify_echo(notifications: list):
    """Send task assignment notifications to ECHO (fire-and-forget)."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.ECHO_API_URL}/notifications/webhook",
                json={
                    "api_key": settings.ECHO_API_KEY,
                    "notifications": notifications,
                },
            )
            if resp.status_code == 200:
                logger.info("echo_notifications_sent", count=len(notifications))
            else:
                logger.warning("echo_notification_failed", status=resp.status_code, body=resp.text)
    except Exception as e:
        logger.warning("echo_notification_error", error=str(e))


@router.post("/{prompt_id}/tasks", response_model=TaskResponse)
async def add_task_to_prompt(
    prompt_id: UUID,
    body: TaskCreate,
    db: AsyncSession = Depends(get_db),
    admin: dict = Depends(require_admin),
):
    """Add a new task to a prompt during the review phase."""
    result = await db.execute(select(Prompt).where(Prompt.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    if prompt.status not in ("pending_review", "processing"):
        raise HTTPException(status_code=400, detail="Prompt is no longer in review")

    task = Task(
        prompt_id=prompt_id,
        title=body.title,
        description=body.description,
        skills_required=body.skills_required or [],
        priority=body.priority or "medium",
        estimated_hours=body.estimated_hours,
        assigned_to=body.assigned_to,
        status="pending",
        extra_data={"manually_added": True},
    )
    db.add(task)

    prompt.tasks_generated = (prompt.tasks_generated or 0) + 1
    await db.commit()
    await db.refresh(task)

    tr = TaskResponse.model_validate(task)
    if task.assigned_to:
        emp_result = await db.execute(select(Employee).where(Employee.id == task.assigned_to))
        emp = emp_result.scalar_one_or_none()
        if emp:
            tr.assigned_to_name = emp.name
    return tr


@router.get("/", response_model=List[PromptResponse])
async def list_prompts(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    result = await db.execute(
        select(Prompt).order_by(desc(Prompt.created_at)).limit(limit)
    )
    prompts = result.scalars().all()

    responses = []
    for p in prompts:
        responses.append(await _build_prompt_response(db, p))
    return responses


@router.get("/{prompt_id}", response_model=PromptResponse)
async def get_prompt(
    prompt_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    result = await db.execute(select(Prompt).where(Prompt.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    return await _build_prompt_response(db, prompt)


async def _build_prompt_response(db: AsyncSession, prompt: Prompt) -> PromptResponse:
    """Build a PromptResponse with tasks, assigned names, and suggestions."""
    task_result = await db.execute(
        select(Task).where(Task.prompt_id == prompt.id).order_by(Task.created_at)
    )
    tasks = task_result.scalars().all()

    # Get employee names for assigned tasks
    employee_ids = [t.assigned_to for t in tasks if t.assigned_to]
    name_map = {}
    if employee_ids:
        emp_result = await db.execute(
            select(Employee).where(Employee.id.in_(employee_ids))
        )
        for emp in emp_result.scalars().all():
            name_map[str(emp.id)] = emp.name

    task_responses = []
    for t in tasks:
        tr = TaskResponse.model_validate(t)
        if t.assigned_to:
            tr.assigned_to_name = name_map.get(str(t.assigned_to))
        # Populate suggestion fields and track name from extra_data
        extra = t.extra_data or {}
        if extra.get("suggested_employee_id"):
            tr.suggested_employee_id = extra["suggested_employee_id"]
            tr.suggested_employee_name = extra.get("suggested_employee_name", "")
        if extra.get("track_name"):
            tr.track_name = extra["track_name"]
        task_responses.append(tr)

    return PromptResponse(
        id=prompt.id,
        raw_text=prompt.raw_text,
        created_by=prompt.created_by,
        project_name=prompt.project_name,
        tasks_generated=prompt.tasks_generated,
        status=prompt.status,
        created_at=prompt.created_at,
        tasks=task_responses,
        llm_response=prompt.llm_response,
    )


# ── Cross-service: ECHO → HERA team lookup ───────────────────────────

@router.post("/team-lookup", summary="Look up project team members (cross-service)")
async def team_lookup(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Called by ECHO to resolve project team members by project name.

    Accepts API key auth (same pattern as task sync webhooks).
    Returns team members with their name, email, and role.
    """
    if body.get("api_key") != settings.SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    search = (body.get("search") or "").strip().lower()

    # Find projects matching the search term (or all recent if no search)
    query = select(Prompt).where(Prompt.project_name.isnot(None)).order_by(desc(Prompt.created_at))
    if search:
        query = query.where(Prompt.project_name.ilike(f"%{search}%"))
    query = query.limit(5)
    result = await db.execute(query)
    prompts = result.scalars().all()

    if not prompts:
        return {"projects": []}

    projects = []
    for prompt in prompts:
        # Get distinct employees assigned to tasks in this project
        emp_result = await db.execute(
            select(distinct(Employee.id), Employee.name, Employee.email, Employee.role)
            .join(Task, Task.assigned_to == Employee.id)
            .where(Task.prompt_id == prompt.id)
            .order_by(Employee.name)
        )
        members = [
            {"name": row[1], "email": row[2], "role": row[3]}
            for row in emp_result.all()
        ]

        if members:
            projects.append({
                "project_id": str(prompt.id),
                "project_name": prompt.project_name,
                "team_members": members,
            })

    return {"projects": projects}
