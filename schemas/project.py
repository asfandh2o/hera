from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class TeamMember(BaseModel):
    id: UUID
    name: str
    role: str


class ProjectSummary(BaseModel):
    id: UUID
    project_name: str
    created_by: str
    created_at: datetime
    status: str
    total_tasks: int
    done_tasks: int
    in_progress_tasks: int
    overdue_tasks: int
    progress_pct: float
    team_members: List[TeamMember] = []


class ProjectDetail(ProjectSummary):
    raw_text: str
    llm_response: Optional[dict] = None
    prompt_status: str
    tasks_by_status: dict = {}
    tasks_by_priority: dict = {}


class ProjectDashboardStats(BaseModel):
    total_projects: int
    in_progress: int
    behind_schedule: int
    completed: int
    not_started: int
