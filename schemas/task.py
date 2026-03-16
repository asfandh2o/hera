from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class TaskResponse(BaseModel):
    id: UUID
    prompt_id: Optional[UUID] = None
    project_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    skills_required: List[str]
    priority: str
    status: str
    assigned_to: Optional[UUID] = None
    assigned_to_name: Optional[str] = None
    assignment_reason: Optional[str] = None
    estimated_hours: Optional[int] = None
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    created_at: datetime
    suggested_employee_id: Optional[str] = None
    suggested_employee_name: Optional[str] = None
    track_name: Optional[str] = None
    blocked_by_ids: List[UUID] = []
    is_blocked: bool = False

    class Config:
        from_attributes = True


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to: Optional[UUID] = None
    start_date: Optional[datetime] = None
    deadline: Optional[datetime] = None
    estimated_hours: Optional[int] = None
    blocked_by_ids: Optional[List[UUID]] = None


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    skills_required: List[str] = []
    priority: str = "medium"
    estimated_hours: Optional[int] = None
    assigned_to: Optional[UUID] = None


class TaskStatusUpdate(BaseModel):
    status: str  # pending, in_progress, done


class TaskAssignment(BaseModel):
    task_id: UUID
    employee_id: Optional[UUID] = None


class ConfirmAssignments(BaseModel):
    assignments: List[TaskAssignment]


class PromptRequest(BaseModel):
    prompt: str


class PromptResponse(BaseModel):
    id: UUID
    raw_text: str
    created_by: str
    project_name: Optional[str] = None
    tasks_generated: int
    status: str
    created_at: datetime
    tasks: List[TaskResponse] = []
    llm_response: Optional[dict] = None

    class Config:
        from_attributes = True
