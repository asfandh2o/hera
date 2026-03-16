from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from uuid import UUID
import httpx
from db.session import get_db
from models.ticket import Ticket
from models.prompt import Prompt
from models.task import Task
from models.employee import Employee
from schemas.ticket import TicketCreate, TicketUpdate, TicketResponse
from api.deps import get_current_user
from core.config import settings
from core.logging import get_logger

router = APIRouter(prefix="/tickets", tags=["tickets"])
logger = get_logger(__name__)


async def _build_ticket_response(db: AsyncSession, ticket: Ticket) -> TicketResponse:
    """Enrich ticket with assigned_to_name, project_name, parent_task_title."""
    tr = TicketResponse.model_validate(ticket)

    if ticket.assigned_to:
        emp_result = await db.execute(select(Employee).where(Employee.id == ticket.assigned_to))
        emp = emp_result.scalar_one_or_none()
        if emp:
            tr.assigned_to_name = emp.name

    prompt_result = await db.execute(select(Prompt).where(Prompt.id == ticket.prompt_id))
    prompt = prompt_result.scalar_one_or_none()
    if prompt:
        tr.project_name = prompt.project_name or "Untitled Project"

    if ticket.task_id:
        task_result = await db.execute(select(Task).where(Task.id == ticket.task_id))
        task = task_result.scalar_one_or_none()
        if task:
            tr.parent_task_title = task.title

    return tr


async def _notify_echo_ticket(employee_email: str, employee_name: str, ticket: Ticket, project_name: str, action: str = "assigned"):
    """Send ticket assignment notification to ECHO (fire-and-forget)."""
    if not settings.ECHO_API_KEY:
        return
    try:
        title_map = {
            "assigned": f"You've been assigned a ticket in {project_name}",
            "created": f"New {ticket.type} ticket in {project_name}",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.ECHO_API_URL}/notifications/webhook",
                json={
                    "api_key": settings.ECHO_API_KEY,
                    "notifications": [{
                        "email": employee_email,
                        "type": "ticket_assigned",
                        "source": "hera",
                        "title": title_map.get(action, title_map["assigned"]),
                        "message": f"[{ticket.type.upper()}] {ticket.title}",
                        "metadata": {
                            "project_name": project_name,
                            "ticket_id": str(ticket.id),
                            "ticket_type": ticket.type,
                            "priority": ticket.priority or "medium",
                        },
                    }],
                },
            )
            if resp.status_code == 200:
                logger.info("echo_ticket_notification_sent", email=employee_email, ticket_id=str(ticket.id))
            else:
                logger.warning("echo_ticket_notification_failed", status=resp.status_code)
    except Exception as e:
        logger.warning("echo_ticket_notification_error", error=str(e))


@router.post("/", response_model=TicketResponse)
async def create_ticket(
    body: TicketCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Create a ticket (admin or employee on their project)."""
    # Verify project exists
    prompt_result = await db.execute(select(Prompt).where(Prompt.id == body.prompt_id))
    prompt = prompt_result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=404, detail="Project not found")

    # Employees can only create tickets on their projects
    if current_user.get("role") == "employee":
        task_check = await db.execute(
            select(Task).where(
                Task.prompt_id == body.prompt_id,
                Task.assigned_to == current_user["id"]
            ).limit(1)
        )
        if not task_check.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not your project")

    ticket = Ticket(
        prompt_id=body.prompt_id,
        task_id=body.task_id,
        title=body.title,
        description=body.description,
        type=body.type,
        priority=body.priority,
        assigned_to=body.assigned_to,
        created_by=current_user["email"],
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)

    # Notify assignee via ECHO
    if ticket.assigned_to:
        emp_result = await db.execute(select(Employee).where(Employee.id == ticket.assigned_to))
        emp = emp_result.scalar_one_or_none()
        if emp:
            project_name = prompt.project_name or "Untitled Project"
            background_tasks.add_task(_notify_echo_ticket, emp.email, emp.name, ticket, project_name, "assigned")

    return await _build_ticket_response(db, ticket)


@router.get("/", response_model=List[TicketResponse])
async def list_tickets(
    prompt_id: Optional[UUID] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """List tickets with optional filters."""
    query = select(Ticket).order_by(desc(Ticket.created_at))

    if prompt_id:
        query = query.where(Ticket.prompt_id == prompt_id)
    if status:
        query = query.where(Ticket.status == status)

    result = await db.execute(query)
    tickets = result.scalars().all()

    return [await _build_ticket_response(db, t) for t in tickets]


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    """Get a single ticket."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    return await _build_ticket_response(db, ticket)


@router.put("/{ticket_id}", response_model=TicketResponse)
async def update_ticket(
    ticket_id: UUID,
    body: TicketUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Update a ticket."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    old_assigned_to = ticket.assigned_to
    update_data = body.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(ticket, field, value)

    await db.commit()
    await db.refresh(ticket)

    # Notify new assignee via ECHO if assigned_to changed
    new_assigned_to = update_data.get("assigned_to")
    if new_assigned_to and str(new_assigned_to) != str(old_assigned_to or ""):
        emp_result = await db.execute(select(Employee).where(Employee.id == new_assigned_to))
        emp = emp_result.scalar_one_or_none()
        if emp:
            prompt_result = await db.execute(select(Prompt).where(Prompt.id == ticket.prompt_id))
            prompt = prompt_result.scalar_one_or_none()
            project_name = (prompt.project_name if prompt else None) or "Untitled Project"
            background_tasks.add_task(_notify_echo_ticket, emp.email, emp.name, ticket, project_name, "assigned")

    return await _build_ticket_response(db, ticket)


@router.delete("/{ticket_id}")
async def delete_ticket(
    ticket_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """Delete a ticket (admin or creator only)."""
    result = await db.execute(select(Ticket).where(Ticket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if current_user["role"] != "admin" and current_user["email"] != ticket.created_by:
        raise HTTPException(status_code=403, detail="Not authorized to delete this ticket")

    await db.delete(ticket)
    await db.commit()
    return {"ok": True}
