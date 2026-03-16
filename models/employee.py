import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from db.session import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    role = Column(String, nullable=False)  # e.g. "Designer", "Developer", "Marketing"
    skills = Column(ARRAY(String), default=[])  # e.g. ["python", "design", "copywriting"]
    max_capacity = Column(Integer, default=5)  # max concurrent tasks
    status = Column(String, default="active")  # active, on_leave, offline
    avatar_url = Column(String, nullable=True)
    extra_data = Column(JSONB, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
