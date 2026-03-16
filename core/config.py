from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # App
    APP_NAME: str = "HERA"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "hera-dev-secret-change-in-production"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://hera:hera_password@db:5432/hera_db"

    # CORS
    CORS_ORIGINS: str = '["http://localhost:3001"]'

    # LLM
    LLM_PROVIDER: str = "groq"
    GROQ_API_KEY: str = ""
    LLM_MODEL: str = "llama-3.3-70b-versatile"

    # Admin credentials (simple auth for MVP)
    ADMIN_EMAIL: str = "admin@nora.ai"
    ADMIN_PASSWORD: str = "admin123"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # ECHO integration (for cross-app notifications)
    ECHO_API_URL: str = "http://host.docker.internal:8000"
    ECHO_API_KEY: str = ""  # Set to ECHO's SECRET_KEY

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return ["http://localhost:3001"]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
