from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from uuid import UUID
from db.session import get_db
from models.employee import Employee
from models.task import Task
from schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from api.deps import require_admin

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("/", response_model=List[EmployeeResponse])
async def list_employees(
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    result = await db.execute(select(Employee).order_by(Employee.name))
    employees = result.scalars().all()

    # Get pending task counts
    task_counts = await db.execute(
        select(Task.assigned_to, func.count(Task.id))
        .where(Task.status.in_(["pending", "assigned", "in_progress"]))
        .group_by(Task.assigned_to)
    )
    count_map = {str(row[0]): row[1] for row in task_counts.all() if row[0]}

    responses = []
    for emp in employees:
        resp = EmployeeResponse.model_validate(emp)
        resp.pending_tasks = count_map.get(str(emp.id), 0)
        responses.append(resp)

    return responses


@router.post("/", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
async def create_employee(
    body: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    # Check duplicate email
    existing = await db.execute(select(Employee).where(Employee.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Employee with this email already exists")

    employee = Employee(
        name=body.name,
        email=body.email,
        role=body.role,
        skills=[s.lower().strip() for s in body.skills],
        max_capacity=body.max_capacity,
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee)

    resp = EmployeeResponse.model_validate(employee)
    resp.pending_tasks = 0
    return resp


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: UUID,
    body: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "skills" and value is not None:
            value = [s.lower().strip() for s in value]
        setattr(employee, field, value)

    await db.commit()
    await db.refresh(employee)
    return EmployeeResponse.model_validate(employee)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    _admin: dict = Depends(require_admin),
):
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    await db.delete(employee)
    await db.commit()
