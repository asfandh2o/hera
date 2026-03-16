import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { FolderKanban, AlertTriangle } from 'lucide-react'
import ProjectStatusBadge from '../components/ui/ProjectStatusBadge'
import Avatar from '../components/ui/Avatar'

export default function ProjectsView() {
  const [projects, setProjects] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      api.listProjects(),
      api.getProjectStats(),
    ])
      .then(([proj, st]) => {
        setProjects(proj)
        setStats(st)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>Projects</h2>

      {/* Stats bar */}
      {stats && (
        <div className="projects-stats">
          <div className="stat-card">
            <span className="stat-card-label">Total Projects</span>
            <span className="stat-card-value">{stats.total_projects}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">In Progress</span>
            <span className="stat-card-value in-progress">{stats.in_progress}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Behind Schedule</span>
            <span className="stat-card-value behind">{stats.behind_schedule}</span>
          </div>
          <div className="stat-card">
            <span className="stat-card-label">Completed</span>
            <span className="stat-card-value completed">{stats.completed}</span>
          </div>
        </div>
      )}

      {/* Project cards */}
      {projects.length === 0 ? (
        <div className="projects-empty">
          <FolderKanban size={40} />
          <p>No projects yet. Create one from the Orchestrate page.</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(p => (
            <div
              key={p.id}
              className="project-card"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <div className="project-card-header">
                <span className="project-card-name">{p.project_name}</span>
                <ProjectStatusBadge status={p.status} />
              </div>

              <div className="project-progress">
                <div className="project-progress-bar">
                  <div
                    className={`project-progress-fill ${p.status === 'completed' ? 'complete' : p.status === 'behind_schedule' ? 'behind' : ''}`}
                    style={{ width: `${p.progress_pct}%` }}
                  />
                </div>
                <div className="project-progress-info">
                  <span>{p.done_tasks}/{p.total_tasks} tasks</span>
                  <span>{p.progress_pct}%</span>
                </div>
              </div>

              <div className="project-card-footer">
                <div className="project-team-avatars">
                  {(p.team_members || []).slice(0, 4).map(m => (
                    <Avatar key={m.id} name={m.name} size="sm" />
                  ))}
                </div>
                {p.overdue_tasks > 0 && (
                  <span className="project-overdue-badge">
                    <AlertTriangle size={12} />
                    {p.overdue_tasks} overdue
                  </span>
                )}
              </div>

              <div className="project-card-date">
                {new Date(p.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
