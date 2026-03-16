import { useState, useEffect } from 'react'
import { api } from '../api'
import { useProject } from '../context/ProjectContext'
import KanbanColumn from '../components/board/KanbanColumn'
import TaskDetailModal from '../components/board/TaskDetailModal'
import { LayoutGrid, FolderKanban, ChevronDown } from 'lucide-react'

export default function BoardView() {
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const { projects, selectedProject, setSelectedProject } = useProject()

  const loadData = async () => {
    try {
      const params = {}
      if (selectedProject) params.prompt_id = selectedProject.id
      const [taskData, empData] = await Promise.all([
        api.listTasks(params),
        api.listEmployees(),
      ])
      setTasks(taskData)
      setEmployees(empData)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [selectedProject])

  // Poll tasks every 5s for real-time sync with ECHO
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const params = {}
        if (selectedProject) params.prompt_id = selectedProject.id
        const taskData = await api.listTasks(params)
        setTasks(taskData)
      } catch {}
    }, 5000)
    return () => clearInterval(interval)
  }, [selectedProject])

  const todo = tasks.filter(t => t.status === 'pending' || t.status === 'assigned')
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  const done = tasks.filter(t => t.status === 'done')

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Board</h2>
        <div className="project-selector">
          <FolderKanban size={14} style={{ color: 'var(--accent)' }} />
          <select
            value={selectedProject?.id || ''}
            onChange={e => {
              if (!e.target.value) setSelectedProject(null)
              else setSelectedProject(projects.find(p => p.id === e.target.value) || null)
            }}
            className="project-dropdown"
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_name || p.raw_text.slice(0, 35)}</option>
            ))}
          </select>
          <ChevronDown size={12} className="project-chevron" />
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="empty-state">
          <LayoutGrid size={40} />
          <p>No tasks yet. Go to Orchestrate to create tasks from a prompt.</p>
        </div>
      ) : (
        <div className="board-container">
          <KanbanColumn
            title="To Do"
            tasks={todo}
            color="var(--status-pending)"
            onTaskClick={setSelectedTask}
          />
          <KanbanColumn
            title="In Progress"
            tasks={inProgress}
            color="var(--status-in-progress)"
            onTaskClick={setSelectedTask}
          />
          <KanbanColumn
            title="Done"
            tasks={done}
            color="var(--status-done)"
            onTaskClick={setSelectedTask}
          />
        </div>
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          employees={employees}
          allTasks={tasks}
          onClose={() => setSelectedTask(null)}
          onSave={() => { setSelectedTask(null); loadData() }}
        />
      )}
    </div>
  )
}
