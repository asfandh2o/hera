from pydantic import BaseModel, EmailStr
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class EmployeeCreate(BaseModel):
    name: str
    email: EmailStr
    role: str
    skills: List[str] = []
    max_capacity: int = 5


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    skills: Optional[List[str]] = None
    max_capacity: Optional[int] = None
    status: Optional[str] = None


class EmployeeResponse(BaseModel):
    id: UUID
    name: str
    email: str
    role: str
    skills: List[str]
    max_capacity: int
    status: str
    pending_tasks: int = 0
    created_at: datetime

    class Config:
        from_attributes = True
