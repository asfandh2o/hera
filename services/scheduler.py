"""
Auto-scheduling service for HERA tasks.

When tasks are confirmed/assigned, this service:
1. Builds a dependency graph (topological sort)
2. Assigns start_date and deadline to each task based on dependency order and estimated_hours
3. Tasks without dependencies start immediately
4. Tasks with dependencies start after all their blockers' deadlines

Also handles overdue timeline shifting:
- When a task misses its deadline, all downstream tasks shift forward automatically
"""

from datetime import datetime, timedelta
from typing import List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.task import Task
from models.task_dependency import TaskDependency
from core.logging import get_logger

logger = get_logger(__name__)

WORK_HOURS_PER_DAY = 8


def _hours_to_days(hours: int) -> int:
    """Convert estimated hours to working days (minimum 1 day)."""
    if not hours or hours <= 0:
        return 1
    return max(1, -(-hours // WORK_HOURS_PER_DAY))  # ceil division


async def auto_schedule_tasks(db: AsyncSession, task_ids: List) -> None:
    """
    Auto-schedule a set of tasks based on their dependencies and estimated_hours.

    Tasks are topologically sorted so that:
    - Tasks with no dependencies start at `now`
    - Tasks that depend on others start after all blockers' deadlines
    - Deadline = start_date + ceil(estimated_hours / 8) days
    """
    if not task_ids:
        return

    # Load tasks
    result = await db.execute(select(Task).where(Task.id.in_(task_ids)))
    tasks = {str(t.id): t for t in result.scalars().all()}

    if not tasks:
        return

    # Load dependencies among these tasks
    dep_result = await db.execute(
        select(TaskDependency).where(TaskDependency.task_id.in_(task_ids))
    )
    deps = dep_result.scalars().all()

    # Build adjacency: task_id -> [depends_on_ids]
    dep_map: Dict[str, List[str]] = {}
    for d in deps:
        dep_map.setdefault(str(d.task_id), []).append(str(d.depends_on_id))

    # Topological sort (Kahn's algorithm)
    in_degree = {tid: 0 for tid in tasks}
    reverse_map: Dict[str, List[str]] = {}  # depends_on_id -> [task_ids that depend on it]

    for tid, dep_ids in dep_map.items():
        for did in dep_ids:
            if did in tasks:  # only count deps within our set
                in_degree[tid] = in_degree.get(tid, 0) + 1
                reverse_map.setdefault(did, []).append(tid)

    # Start with tasks that have no in-set dependencies
    queue = [tid for tid, deg in in_degree.items() if deg == 0]
    sorted_ids = []

    while queue:
        # Sort queue to get deterministic order (by priority: critical > high > medium > low)
        priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        queue.sort(key=lambda tid: priority_order.get(tasks[tid].priority, 2))
        current = queue.pop(0)
        sorted_ids.append(current)

        for downstream in reverse_map.get(current, []):
            in_degree[downstream] -= 1
            if in_degree[downstream] == 0:
                queue.append(downstream)

    # Any tasks not in sorted_ids have circular deps — add them at the end
    for tid in tasks:
        if tid not in sorted_ids:
            sorted_ids.append(tid)

    # Schedule: assign dates based on topological order
    now = datetime.utcnow().replace(hour=9, minute=0, second=0, microsecond=0)
    # If it's past 9am, start tomorrow
    if datetime.utcnow().hour >= 17:
        now += timedelta(days=1)

    deadlines: Dict[str, datetime] = {}  # task_id -> deadline

    for tid in sorted_ids:
        task = tasks[tid]
        duration_days = _hours_to_days(task.estimated_hours)

        # Determine start: max of all blocker deadlines, or now
        blocker_ids = dep_map.get(tid, [])
        blocker_deadlines = [deadlines[bid] for bid in blocker_ids if bid in deadlines]

        if blocker_deadlines:
            start = max(blocker_deadlines)
        else:
            start = now

        deadline = start + timedelta(days=duration_days)

        task.start_date = start
        task.deadline = deadline
        deadlines[tid] = deadline

    await db.commit()

    logger.info(
        "tasks_auto_scheduled",
        task_count=len(sorted_ids),
    )


async def shift_overdue_downstream(db: AsyncSession, overdue_task_id: str) -> List[str]:
    """
    When an overdue task hasn't been completed, shift all downstream task dates forward.

    Returns list of task IDs that were shifted.
    """
    now = datetime.utcnow()

    # Load the overdue task
    result = await db.execute(select(Task).where(Task.id == overdue_task_id))
    overdue_task = result.scalar_one_or_none()
    if not overdue_task or not overdue_task.deadline:
        return []

    # How many days overdue?
    slip = (now - overdue_task.deadline).total_seconds() / (24 * 3600)
    if slip <= 0:
        return []  # Not actually overdue

    slip_delta = timedelta(days=max(1, int(slip)))

    # Find all downstream tasks (BFS)
    shifted = []
    queue = [overdue_task_id]
    visited = set()

    while queue:
        current_id = queue.pop(0)
        if current_id in visited:
            continue
        visited.add(current_id)

        # Find tasks that depend on current_id
        dep_result = await db.execute(
            select(TaskDependency).where(TaskDependency.depends_on_id == current_id)
        )
        downstream_deps = dep_result.scalars().all()

        for dep in downstream_deps:
            downstream_id = str(dep.task_id)
            if downstream_id in visited:
                continue

            task_result = await db.execute(
                select(Task).where(Task.id == dep.task_id)
            )
            downstream_task = task_result.scalar_one_or_none()
            if not downstream_task or downstream_task.status == "done":
                continue

            # Shift dates forward
            if downstream_task.start_date:
                new_start = max(downstream_task.start_date, now)
                if new_start != downstream_task.start_date:
                    duration = timedelta(days=0)
                    if downstream_task.deadline and downstream_task.start_date:
                        duration = downstream_task.deadline - downstream_task.start_date
                    downstream_task.start_date = new_start
                    if duration.total_seconds() > 0:
                        downstream_task.deadline = new_start + duration
                    elif downstream_task.estimated_hours:
                        downstream_task.deadline = new_start + timedelta(
                            days=_hours_to_days(downstream_task.estimated_hours)
                        )

            shifted.append(downstream_id)
            queue.append(downstream_id)

    if shifted:
        await db.commit()
        logger.info("downstream_tasks_shifted", overdue_task=overdue_task_id, shifted_count=len(shifted))

    return shifted
