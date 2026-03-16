import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from db.session import Base


class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raw_text = Column(Text, nullable=False)  # The original prompt from leadership
    created_by = Column(String, nullable=False)  # admin email
    project_name = Column(String, nullable=True)  # LLM-generated short project title
    tasks_generated = Column(Integer, default=0)
    status = Column(String, default="processing")  # processing, completed, failed
    llm_response = Column(JSONB, nullable=True)  # Full LLM breakdown response
    created_at = Column(DateTime, default=datetime.utcnow)
