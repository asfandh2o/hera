import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from db.session import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id"), nullable=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    skills_required = Column(ARRAY(String), default=[])
    priority = Column(String, default="medium")  # critical, high, medium, low
    status = Column(String, default="pending")  # pending, assigned, in_progress, done
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=True)
    assignment_reason = Column(Text, nullable=True)  # LLM explanation of why this employee
    estimated_hours = Column(Integer, nullable=True)
    deadline = Column(DateTime, nullable=True)
    start_date = Column(DateTime, nullable=True)
    extra_data = Column(JSONB, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
