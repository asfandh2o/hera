# HERA — Project Orchestration Engine
## Complete Application Flow

---

## Admin Flow

### Screen 1: Login

The login screen offers two tabs — Manager and Employee. Managers enter their email and password. Employees enter only their email. The selected role determines which part of the system the user sees after logging in.

**[Screenshot: Login page with Manager tab selected]**

---

### Screen 2: Orchestrate — AI Project Generation

The Orchestrate view is where projects are born. The admin types a natural language description of what needs to be done (e.g., "Build an AI payroll system with React frontend and Python backend") or uploads project documentation (PDF, DOCX, TXT). The right panel shows the current team members available for assignment.

HERA's AI analyzes the input and breaks it down into tasks with priorities, skill requirements, estimated hours, and suggested team assignments.

**[Screenshot: Orchestrate view with the chat input and team panel on the right]**

---

### Screen 3: Task Review Modal

After the AI generates tasks, a review modal opens. It shows a summary (total tasks, how many are assigned, how many are unassigned) and a table of every generated task. Each row shows the priority, title, required skills, estimated hours, and an assignee dropdown.

The admin can:
- Change any assignment using the dropdown
- Add new tasks manually
- Delete tasks that are not needed
- Click "Start Project" to confirm everything

**[Screenshot: Task Review Modal showing generated tasks with assignee dropdowns]**

---

### Screen 4: Board View — Kanban

The Board view is a real-time Kanban board with three columns: To Do, In Progress, and Done. Each task appears as a card showing the title, assignee avatar, priority badge, and deadline info. The board updates in real time as employees work on their tasks.

A project dropdown at the top filters the board to a specific project. Clicking any task card opens a detail modal for editing.

**[Screenshot: Kanban board with tasks distributed across To Do, In Progress, and Done columns]**

---

### Screen 5: Task Detail Modal

Clicking a task card anywhere in the system opens the Task Detail Modal. From here, the admin can:

- Change the task status
- Reassign it to a different team member
- Adjust the priority and estimated hours
- Set or modify deadlines
- Add or remove task dependencies
- Delete the task entirely

**[Screenshot: Task Detail Modal with status, assignee, priority, and dependency fields]**

---

### Screen 6: Timeline View — Gantt Chart

The Timeline view shows a Gantt chart with employee names on the left and a calendar grid on the right. Task bars are positioned by date and color-coded by priority. The current day is marked with a vertical red line. Weekends are shaded.

Status indicators show whether a task is completed (filled bar), in progress (animated), blocked (red), or overdue (red exclamation mark). Hovering a task bar shows a tooltip with full details.

**[Screenshot: Gantt chart showing tasks across a timeline with the today marker]**

---

### Screen 7: Team View — Member Management

The Team view displays a grid of team member cards. Each card shows the member's name, role, email, a workload meter (tasks assigned vs. maximum capacity), and skill badges.

The admin can add new members by entering their name, email, role, maximum capacity, and skills. Members can also be removed from this view.

**[Screenshot: Team view with member cards showing workload meters and skill badges]**

---

### Screen 8: History View — Project Audit Trail

The History view is a table of all past orchestration prompts. Each row shows a status icon (completed, failed, in progress, pending review), the prompt text, the number of tasks generated, and the creation date. This serves as an audit trail for every project the admin has created.

**[Screenshot: History table showing past prompts with status icons and task counts]**

---

## Employee Flow

### Screen 9: Employee Login

Employees select the "Employee" tab on the login page and enter only their email address (no password). They are taken directly to their personal task view.

**[Screenshot: Login page with Employee tab selected]**

---

### Screen 10: My Tasks — List View

The employee's dedicated view shows all tasks assigned to them. Each task card displays the title, priority badge, description, required skills, estimated hours, deadline indicators, and project name.

The employee can:
- Click "Start" to begin working on a task (moves it to In Progress)
- Click "Done" to mark a completed task
- See if a task is blocked due to unfinished dependencies (shown with a lock icon)
- Filter tasks by project using the dropdown
- Switch between List and Timeline views

A completed tasks section at the bottom shows the last 5 finished items.

**[Screenshot: My Tasks list view with task cards, Start/Done buttons, and deadline indicators]**

---

### Screen 11: My Tasks — Timeline View

Switching to the Timeline toggle shows the employee a personal Gantt chart of their assigned tasks, organized by project. This helps them understand sequencing and deadlines visually.

**[Screenshot: Employee timeline view showing their tasks on a Gantt chart]**

---

### Cross-Module Connections

- When tasks are confirmed in HERA, assigned employees receive notifications in ECHO
- ECHO queries HERA to look up project team members when drafting emails or creating calendar events for a project
- Task completion data from HERA feeds into ARGUS for productivity scoring (task completion rate, timeliness)
- Real-time sync: employees updating task status in My Tasks is reflected on the admin's Board view within seconds
