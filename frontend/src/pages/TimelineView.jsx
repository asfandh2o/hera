import { useState, useEffect } from 'react'
import { api } from '../api'
import { useProject } from '../context/ProjectContext'
import { layoutTasksSequentially } from '../utils/gantt'
import GanttChart from '../components/gantt/GanttChart'
import TaskDetailModal from '../components/board/TaskDetailModal'
import { FolderKanban, ChevronDown } from 'lucide-react'

export default function TimelineView() {
  const [rows, setRows] = useState([])
  const [employees, setEmployees] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const { projects, selectedProject, setSelectedProject } = useProject()

  const loadData = async () => {
    try {
      const promptId = selectedProject?.id || null
      const [timelineData, empData] = await Promise.all([
        api.getTimeline(promptId),
        api.listEmployees(),
      ])
      // Apply sequential layout per employee row
      const sequentialRows = timelineData.map(row => ({
        ...row,
        tasks: layoutTasksSequentially(row.tasks),
      }))
      setRows(sequentialRows)
      setEmployees(empData)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [selectedProject])

  const handleTaskClick = (task) => {
    const fullTask = {
      ...task,
      assigned_to: null,
    }
    setSelectedTask(fullTask)
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Timeline</h2>
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

      <GanttChart rows={rows} onTaskClick={handleTaskClick} />

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          employees={employees}
          onClose={() => setSelectedTask(null)}
          onSave={() => { setSelectedTask(null); loadData() }}
        />
      )}
    </div>
  )
}
