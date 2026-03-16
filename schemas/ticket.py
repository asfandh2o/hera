from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class TicketCreate(BaseModel):
    prompt_id: UUID
    task_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    type: str = "issue"
    priority: str = "medium"
    assigned_to: Optional[UUID] = None


class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[UUID] = None
    task_id: Optional[UUID] = None


class TicketResponse(BaseModel):
    id: UUID
    prompt_id: UUID
    task_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    type: str
    priority: str
    status: str
    created_by: str
    assigned_to: Optional[UUID] = None
    assigned_to_name: Optional[str] = None
    project_name: Optional[str] = None
    parent_task_title: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
