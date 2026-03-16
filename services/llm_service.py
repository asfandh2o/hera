from typing import List, Dict, Any
from groq import AsyncGroq
from core.config import settings
from core.logging import get_logger
import json

logger = get_logger(__name__)


class LLMService:
    def __init__(self):
        self.client = AsyncGroq(api_key=settings.GROQ_API_KEY)
        self.model = settings.LLM_MODEL

    async def break_down_prompt(self, prompt: str) -> Dict[str, Any]:
        """Take a high-level prompt and break it into a rich orchestration plan with tracks."""
        system = """You are HERA, an intelligent task orchestrator and strategic planner.
Given a high-level directive, analyze it and create a structured orchestration plan.

The input may contain PROJECT DOCUMENTATION (BRD, specs, requirements docs, etc.) followed by a DIRECTIVE.
When documentation is provided, use it as the primary source of truth — extract features, requirements, milestones, and technical details from the documents to create an accurate and comprehensive plan.
If no documentation is provided, work from the directive alone.

TRACK ORGANIZATION RULES:
- When the document describes distinct modules, products, or major feature areas, create ONE TRACK PER MODULE (e.g. "ECHO MODULE TRACK", "HERA MODULE TRACK"). Do NOT lump everything into generic "Development" or "Frontend" tracks.
- You may add cross-cutting tracks like "INFRASTRUCTURE & INTEGRATION TRACK" or "TESTING & QA TRACK" in addition to module tracks, but these must NOT replace the module-specific tracks.
- Each module track must have sub-teams covering ALL features described for that module in the document.
- Generate at least 3-5 tasks per module. More for complex modules. Every major feature or subsection in the document should map to at least one task.
- Be thorough: if the document describes 5 modules, you must produce 5 module tracks. Do NOT skip or combine modules.

Return a JSON object with:
- project_name: A short project title (under 40 chars)
- narrative: A 2-3 sentence strategic analysis starting with "I have analyzed the strategic directive..."
- source_material: Brief description of the input provided (e.g. "User directive")
- staff_allocation_percent: Percentage of bandwidth this project requires (integer, 50-100)
- tracks: An array of track objects grouping related work

For each track, include:
- track_name: e.g. "ECHO MODULE TRACK" or "INFRASTRUCTURE TRACK" (uppercase)
- member_count: Number of people needed for this track (integer)
- objective: One sentence describing the track's goal
- sub_teams: Array of sub-team objects

For each sub_team, include:
- sub_team_name: e.g. "Email Intelligence (Backend)" or "Calendar Management"
- tasks: Array of task objects within this sub-team

For each task, include:
- title: Short task name (under 60 chars)
- description: Clear description of what needs to be done (1-2 sentences)
- skills_required: List of skills needed (e.g. ["python", "design", "frontend", "backend", "devops", "marketing", "copywriting", "data_analysis"])
- priority: "critical", "high", "medium", or "low"
- estimated_hours: Estimated hours to complete (integer)

Also include:
- orchestration_note: A warning or advisory paragraph about risks, bottlenecks, or considerations for this initiative
- dependencies: An array of dependency pairs showing task execution order.
  Each item is {"task_index": <index of task that must wait>, "depends_on_index": <index of task that must finish first>}.
  Use the task's position in the flattened task list (0-indexed, in the order they appear across all tracks/sub-teams).
  Example: [{"task_index": 3, "depends_on_index": 1}] means task 3 cannot start until task 1 is done.
  Think logically: you can't test before developing, can't deploy before testing, can't design marketing before having a product, etc.

Return ONLY valid JSON. No explanation, no markdown."""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=12000,
            )

            raw = response.choices[0].message.content.strip()

            # Strip markdown code fences if present
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()

            parsed = json.loads(raw)

            # Handle legacy format (flat array or flat {project_name, tasks})
            if isinstance(parsed, list):
                return {
                    "project_name": "Untitled Project",
                    "tasks": parsed,
                    "full_response": {"project_name": "Untitled Project", "tracks": [], "narrative": "", "orchestration_note": ""},
                }

            # Extract flat task list from tracks
            tracks = parsed.get("tracks", [])
            flat_tasks = []
            for track in tracks:
                track_name = track.get("track_name", "")
                for sub_team in track.get("sub_teams", []):
                    sub_team_name = sub_team.get("sub_team_name", "")
                    for task in sub_team.get("tasks", []):
                        task["_track_name"] = track_name
                        task["_sub_team_name"] = sub_team_name
                        flat_tasks.append(task)

            # Fallback: if tracks were empty but tasks field exists (old format)
            if not flat_tasks and parsed.get("tasks"):
                flat_tasks = parsed.get("tasks", [])

            project_name = parsed.get("project_name", "Untitled Project")

            logger.info("prompt_broken_down", task_count=len(flat_tasks), project_name=project_name, tracks=len(tracks))
            return {
                "project_name": project_name,
                "tasks": flat_tasks,
                "full_response": parsed,
            }

        except json.JSONDecodeError as e:
            logger.error("llm_json_parse_error", error=str(e), raw=raw[:200])
            raise ValueError(f"Failed to parse LLM response as JSON: {e}")
        except Exception as e:
            error_msg = str(e).lower()
            if "rate_limit" in error_msg or "429" in error_msg:
                logger.warning("llm_rate_limited", error=str(e))
                raise ValueError("Rate limit reached. Please try again in a few minutes.")
            logger.error("llm_breakdown_error", error=str(e))
            raise

    async def allocate_tasks(
        self,
        tasks: List[Dict[str, Any]],
        employees: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """Smartly allocate tasks to employees based on skills, workload, and availability."""
        system = """You are HERA, an intelligent task allocator.
Given a list of tasks and available employees, assign each task to the best employee.

Consider:
1. SKILL MATCH: Employee skills must match task requirements (most important)
2. WORKLOAD: Prefer employees with fewer pending tasks (check pending_tasks vs max_capacity)
3. AVAILABILITY: Only assign to employees with status "active"
4. BALANCE: Distribute work evenly — don't overload one person

For each task, return:
- task_index: The index of the task (0-based)
- employee_id: UUID of the assigned employee
- reason: One sentence explaining why this employee was chosen

Return ONLY a JSON array. No explanation, no markdown.
Example: [{"task_index": 0, "employee_id": "uuid-here", "reason": "Best skill match for design with lowest workload"}]

If no suitable employee exists for a task, set employee_id to null and reason to "No matching employee available"."""

        prompt = f"""TASKS:
{json.dumps(tasks, indent=2)}

EMPLOYEES:
{json.dumps(employees, indent=2)}

Assign each task to the best employee."""

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.2,
                max_tokens=4000,
            )

            raw = response.choices[0].message.content.strip()

            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()

            allocations = json.loads(raw)
            logger.info("tasks_allocated", allocation_count=len(allocations))
            return allocations

        except json.JSONDecodeError as e:
            logger.error("allocation_json_parse_error", error=str(e))
            raise ValueError(f"Failed to parse allocation response: {e}")
        except Exception as e:
            error_msg = str(e).lower()
            if "rate_limit" in error_msg or "429" in error_msg:
                raise ValueError("Rate limit reached. Please try again in a few minutes.")
            logger.error("allocation_error", error=str(e))
            raise


llm_service = LLMService()
