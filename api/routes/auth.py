from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.session import get_db
from models.employee import Employee
from schemas.auth import LoginRequest, LoginResponse, EmployeeLoginRequest
from core.config import settings
from core.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def admin_login(body: LoginRequest):
    """Admin login with email/password."""
    if body.email != settings.ADMIN_EMAIL or body.password != settings.ADMIN_PASSWORD:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"email": body.email, "role": "admin"})
    return LoginResponse(token=token, email=body.email, role="admin", name="Admin")


@router.post("/employee-login", response_model=LoginResponse)
async def employee_login(
    body: EmployeeLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """Employee login with just email (simplified for MVP)."""
    result = await db.execute(select(Employee).where(Employee.email == body.email))
    employee = result.scalar_one_or_none()

    if not employee:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Employee not found")

    token = create_access_token({"email": employee.email, "role": "employee", "employee_id": str(employee.id)})
    return LoginResponse(token=token, email=employee.email, role="employee", name=employee.name)
