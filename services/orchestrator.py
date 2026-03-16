from typing import List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from models.employee import Employee
from models.task import Task
from models.prompt import Prompt
from models.task_dependency import TaskDependency
from services.llm_service import llm_service
from services.scheduler import auto_schedule_tasks
from core.logging import get_logger

logger = get_logger(__name__)


class Orchestrator:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def process_prompt(self, raw_text: str, created_by: str) -> Prompt:
        """Full pipeline: prompt → task breakdown → suggest allocations (don't auto-assign)."""

        # 1. Save the prompt
        prompt = Prompt(raw_text=raw_text, created_by=created_by, status="processing")
        self.db.add(prompt)
        await self.db.commit()
        await self.db.refresh(prompt)

        try:
            # 2. LLM breaks down the prompt into tasks (returns {project_name, tasks, full_response})
            llm_result = await llm_service.break_down_prompt(raw_text)
            task_defs = llm_result["tasks"]
            full_response = llm_result.get("full_response", {})
            prompt.project_name = llm_result.get("project_name", "Untitled Project")

            # 3. Create task records (NOT assigned yet — pending review)
            tasks = []
            for t in task_defs:
                task = Task(
                    prompt_id=prompt.id,
                    title=t.get("title", "Untitled Task"),
                    description=t.get("description"),
                    skills_required=t.get("skills_required", []),
                    priority=t.get("priority", "medium"),
                    estimated_hours=t.get("estimated_hours"),
                    start_date=datetime.utcnow(),
                    status="pending",
                    extra_data={
                        "track_name": t.get("_track_name", ""),
                        "sub_team_name": t.get("_sub_team_name", ""),
                    },
                )
                self.db.add(task)
                tasks.append(task)

            await self.db.commit()
            for task in tasks:
                await self.db.refresh(task)

            # 3b. Create dependencies from LLM-inferred execution order
            llm_deps = full_response.get("dependencies", [])
            for dep in llm_deps:
                task_idx = dep.get("task_index")
                depends_on_idx = dep.get("depends_on_index")
                if (
                    task_idx is not None
                    and depends_on_idx is not None
                    and 0 <= task_idx < len(tasks)
                    and 0 <= depends_on_idx < len(tasks)
                    and task_idx != depends_on_idx
                ):
                    self.db.add(TaskDependency(
                        task_id=tasks[task_idx].id,
                        depends_on_id=tasks[depends_on_idx].id,
                    ))
            if llm_deps:
                await self.db.commit()

            # 4. Get available employees with their workloads
            employees = await self._get_employees_with_workload()

            if employees:
                # 5. LLM suggests allocations (but does NOT apply them)
                task_data = [
                    {
                        "index": i,
                        "title": t.title,
                        "description": t.description,
                        "skills_required": t.skills_required,
                        "priority": t.priority,
                        "estimated_hours": t.estimated_hours,
                    }
                    for i, t in enumerate(tasks)
                ]

                allocations = await llm_service.allocate_tasks(task_data, employees)

                # 6. Store suggestions in extra_data (NOT in assigned_to)
                emp_name_map = {e["id"]: e["name"] for e in employees}
                for alloc in allocations:
                    idx = alloc.get("task_index", 0)
                    emp_id = alloc.get("employee_id")
                    reason = alloc.get("reason", "")

                    if idx < len(tasks) and emp_id:
                        existing = tasks[idx].extra_data or {}
                        existing.update({
                            "suggested_employee_id": emp_id,
                            "suggested_employee_name": emp_name_map.get(emp_id, ""),
                            "suggestion_reason": reason,
                        })
                        tasks[idx].extra_data = existing
                        tasks[idx].assignment_reason = reason

                await self.db.commit()

            # 7. Update prompt — status is "pending_review" so manager can confirm
            prompt.tasks_generated = len(tasks)
            prompt.status = "pending_review"
            prompt.llm_response = full_response
            await self.db.commit()
            await self.db.refresh(prompt)

            logger.info(
                "prompt_processed",
                prompt_id=str(prompt.id),
                tasks_created=len(tasks),
                employees_available=len(employees),
            )

            return prompt

        except Exception as e:
            prompt.status = "failed"
            prompt.llm_response = {"error": str(e)}
            await self.db.commit()
            logger.error("prompt_processing_failed", prompt_id=str(prompt.id), error=str(e))
            raise

    async def _get_employees_with_workload(self) -> List[Dict[str, Any]]:
        """Get all active employees with their current pending task counts."""
        # Get employees
        result = await self.db.execute(
            select(Employee).where(Employee.status == "active")
        )
        employees = result.scalars().all()

        # Get pending task counts per employee
        task_counts = await self.db.execute(
            select(Task.assigned_to, func.count(Task.id))
            .where(Task.status.in_(["pending", "assigned", "in_progress"]))
            .group_by(Task.assigned_to)
        )
        count_map = {str(row[0]): row[1] for row in task_counts.all() if row[0]}

        employee_data = []
        for emp in employees:
            pending = count_map.get(str(emp.id), 0)
            if pending >= emp.max_capacity:
                continue  # Skip overloaded employees

            employee_data.append({
                "id": str(emp.id),
                "name": emp.name,
                "email": emp.email,
                "role": emp.role,
                "skills": emp.skills or [],
                "max_capacity": emp.max_capacity,
                "pending_tasks": pending,
                "available_capacity": emp.max_capacity - pending,
            })

        return employee_data
