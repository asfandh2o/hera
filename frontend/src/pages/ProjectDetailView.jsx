import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import {
  ArrowLeft, LayoutGrid, GanttChart as GanttIcon, Eye, FolderKanban,
  Ticket, Plus, Trash2, Loader2, Bug, HelpCircle, Lightbulb, AlertCircle,
  ChevronRight, ChevronDown, FileText, Link2, Pencil, X, Save
} from 'lucide-react'
import ProjectStatusBadge from '../components/ui/ProjectStatusBadge'
import Avatar from '../components/ui/Avatar'
import PriorityBadge from '../components/ui/PriorityBadge'
import KanbanColumn from '../components/board/KanbanColumn'
import GanttChart from '../components/gantt/GanttChart'
import TaskDetailModal from '../components/board/TaskDetailModal'

const TABS = [
  { key: 'overview', label: 'Overview', icon: Eye },
  { key: 'board', label: 'Board', icon: LayoutGrid },
  { key: 'timeline', label: 'Timeline', icon: GanttIcon },
  { key: 'tickets', label: 'Tickets', icon: Ticket },
]

const TICKET_TYPES = ['bug', 'issue', 'improvement', 'question']
const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed']
const PRIORITIES = ['critical', 'high', 'medium', 'low']

const TYPE_ICONS = {
  bug: Bug,
  issue: AlertCircle,
  improvement: Lightbulb,
  question: HelpCircle,
}

export default function ProjectDetailView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [tickets, setTickets] = useState([])
  const [timelineData, setTimelineData] = useState([])
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [selectedTask, setSelectedTask] = useState(null)
  const [employees, setEmployees] = useState([])

  // Ticket form state
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [newTicket, setNewTicket] = useState({ title: '', description: '', type: 'issue', priority: 'medium', task_id: '', assigned_to: '' })
  const [creatingTicket, setCreatingTicket] = useState(false)

  const loadData = async () => {
    try {
      const [proj, taskList, ticketList, timeline, emps] = await Promise.all([
        api.getProjectDetail(id),
        api.listTasks({ prompt_id: id }),
        api.listTickets({ prompt_id: id }),
        api.getTimeline(id),
        api.listEmployees(),
      ])
      setProject(proj)
      setTasks(taskList)
      setTickets(ticketList)
      setTimelineData(timeline)
      setEmployees(emps)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  const handleTaskClick = (task) => setSelectedTask(task)

  const handleTaskSave = async () => {
    setSelectedTask(null)
    await loadData()
  }

  const handleCreateTicket = async () => {
    if (!newTicket.title.trim()) return
    setCreatingTicket(true)
    try {
      await api.createTicket({
        prompt_id: id,
        title: newTicket.title.trim(),
        description: newTicket.description.trim() || null,
        type: newTicket.type,
        priority: newTicket.priority,
        task_id: newTicket.task_id || null,
        assigned_to: newTicket.assigned_to || null,
      })
      setNewTicket({ title: '', description: '', type: 'issue', priority: 'medium', task_id: '', assigned_to: '' })
      setShowTicketForm(false)
      const updated = await api.listTickets({ prompt_id: id })
      setTickets(updated)
    } catch (e) {
      console.error(e)
    }
    setCreatingTicket(false)
  }

  const handleTicketAssignChange = async (ticketId, assignedTo) => {
    try {
      await api.updateTicket(ticketId, { assigned_to: assignedTo || null })
      const updated = await api.listTickets({ prompt_id: id })
      setTickets(updated)
    } catch (e) {
      console.error(e)
    }
  }

  const handleTicketStatusChange = async (ticketId, status) => {
    try {
      await api.updateTicket(ticketId, { status })
      const updated = await api.listTickets({ prompt_id: id })
      setTickets(updated)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteTicket = async (ticketId) => {
    try {
      await api.deleteTicket(ticketId)
      setTickets(prev => prev.filter(t => t.id !== ticketId))
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpdateTicket = async (ticketId, data) => {
    try {
      await api.updateTicket(ticketId, data)
      const updated = await api.listTickets({ prompt_id: id })
      setTickets(updated)
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
  if (!project) return <div className="projects-empty"><p>Project not found</p></div>

  const todoTasks = tasks.filter(t => t.status === 'pending' || t.status === 'assigned')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
  const doneTasks = tasks.filter(t => t.status === 'done')

  return (
    <div>
      {/* Header */}
      <div className="project-detail-header">
        <button className="project-detail-back" onClick={() => navigate('/projects')}>
          <ArrowLeft size={20} />
        </button>
        <div className="project-detail-info">
          <div className="project-detail-name">{project.project_name}</div>
          <div className="project-detail-meta">
            <ProjectStatusBadge status={project.status} />
            <span>{project.done_tasks}/{project.total_tasks} tasks done</span>
            <span>{new Date(project.created_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="project-team-avatars">
          {(project.team_members || []).slice(0, 5).map(m => (
            <Avatar key={m.id} name={m.name} size="sm" />
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="project-tabs">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              className={`project-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <Icon size={14} />
              {t.label}
              {t.key === 'tickets' && tickets.length > 0 && (
                <span className="project-tab-count">{tickets.length}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'overview' && <OverviewTab project={project} tasks={tasks} />}
      {tab === 'board' && (
        <div className="board-columns">
          <KanbanColumn title="To Do" tasks={todoTasks} color="var(--status-pending)" onTaskClick={handleTaskClick} />
          <KanbanColumn title="In Progress" tasks={inProgressTasks} color="var(--status-in-progress)" onTaskClick={handleTaskClick} />
          <KanbanColumn title="Done" tasks={doneTasks} color="var(--status-done)" onTaskClick={handleTaskClick} />
        </div>
      )}
      {tab === 'timeline' && (
        <GanttChart rows={timelineData} onTaskClick={handleTaskClick} />
      )}
      {tab === 'tickets' && (
        <TicketsTab
          tickets={tickets}
          tasks={tasks}
          employees={employees}
          showForm={showTicketForm}
          setShowForm={setShowTicketForm}
          newTicket={newTicket}
          setNewTicket={setNewTicket}
          creating={creatingTicket}
          onCreate={handleCreateTicket}
          onStatusChange={handleTicketStatusChange}
          onAssignChange={handleTicketAssignChange}
          onDelete={handleDeleteTicket}
          onUpdate={handleUpdateTicket}
        />
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          employees={employees}
          allTasks={tasks}
          onClose={() => setSelectedTask(null)}
          onSave={handleTaskSave}
        />
      )}
    </div>
  )
}


function OverviewTab({ project, tasks }) {
  const statusColors = {
    pending: 'var(--status-pending)',
    assigned: 'var(--status-assigned)',
    in_progress: 'var(--status-in-progress)',
    done: 'var(--status-done)',
  }

  const priorityColors = {
    critical: 'var(--priority-critical)',
    high: 'var(--priority-high)',
    medium: 'var(--priority-medium)',
    low: 'var(--priority-low)',
  }

  // Compute breakdowns from tasks
  const byStatus = {}
  const byPriority = {}
  tasks.forEach(t => {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1
  })

  return (
    <div className="overview-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* LLM narrative */}
        {project.llm_response?.summary && (
          <div className="overview-card">
            <div className="overview-card-title">Project Plan</div>
            <div className="overview-narrative">{project.llm_response.summary}</div>
          </div>
        )}

        {/* Progress */}
        <div className="overview-card">
          <div className="overview-card-title">Progress</div>
          <div className="project-progress">
            <div className="project-progress-bar">
              <div
                className={`project-progress-fill ${project.status === 'completed' ? 'complete' : project.status === 'behind_schedule' ? 'behind' : ''}`}
                style={{ width: `${project.progress_pct}%` }}
              />
            </div>
            <div className="project-progress-info">
              <span>{project.done_tasks}/{project.total_tasks} tasks completed</span>
              <span>{project.progress_pct}%</span>
            </div>
          </div>
        </div>

        {/* Tasks by Status */}
        <div className="overview-card">
          <div className="overview-card-title">Tasks by Status</div>
          <div className="overview-breakdown">
            {Object.entries(byStatus).map(([s, count]) => (
              <div key={s} className="overview-breakdown-item">
                <span className="overview-breakdown-label">
                  <span className="overview-breakdown-dot" style={{ background: statusColors[s] || '#666' }} />
                  {s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}
                </span>
                <span className="overview-breakdown-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Tasks by Priority */}
        <div className="overview-card">
          <div className="overview-card-title">Tasks by Priority</div>
          <div className="overview-breakdown">
            {Object.entries(byPriority).map(([p, count]) => (
              <div key={p} className="overview-breakdown-item">
                <span className="overview-breakdown-label">
                  <span className="overview-breakdown-dot" style={{ background: priorityColors[p] || '#666' }} />
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </span>
                <span className="overview-breakdown-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="overview-card">
          <div className="overview-card-title">Team</div>
          <div className="overview-team-list">
            {(project.team_members || []).map(m => {
              const memberTasks = tasks.filter(t => String(t.assigned_to) === m.id)
              const memberDone = memberTasks.filter(t => t.status === 'done').length
              return (
                <div key={m.id} className="overview-team-member">
                  <Avatar name={m.name} size="sm" />
                  <div className="overview-team-member-info">
                    <div className="overview-team-member-name">{m.name}</div>
                    <div className="overview-team-member-role">{m.role} &middot; {memberDone}/{memberTasks.length} done</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Overdue tasks */}
        {project.overdue_tasks > 0 && (
          <div className="overview-card">
            <div className="overview-card-title" style={{ color: 'var(--project-behind)' }}>Overdue Tasks</div>
            <div className="overview-breakdown">
              {tasks.filter(t => t.deadline && t.status !== 'done' && new Date(t.deadline) < new Date()).map(t => (
                <div key={t.id} className="overview-breakdown-item">
                  <span className="overview-breakdown-label">
                    <PriorityBadge priority={t.priority} />
                    <span style={{ marginLeft: 4 }}>{t.title}</span>
                  </span>
                  <span className="overview-breakdown-count" style={{ color: 'var(--project-behind)', fontSize: 11 }}>
                    {new Date(t.deadline).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


function TicketsTab({ tickets, tasks, employees, showForm, setShowForm, newTicket, setNewTicket, creating, onCreate, onStatusChange, onAssignChange, onDelete, onUpdate }) {
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})

  const startEditing = (ticket) => {
    setEditingId(ticket.id)
    setEditData({ title: ticket.title, description: ticket.description || '', type: ticket.type, priority: ticket.priority, task_id: ticket.task_id || '' })
  }

  const saveEdit = async () => {
    if (!editData.title?.trim()) return
    await onUpdate(editingId, {
      title: editData.title.trim(),
      description: editData.description.trim() || null,
      type: editData.type,
      priority: editData.priority,
      task_id: editData.task_id || null,
    })
    setEditingId(null)
  }

  return (
    <div>
      {/* Create button */}
      {!showForm && (
        <button className="btn btn-primary" style={{ marginBottom: 16 }} onClick={() => setShowForm(true)}>
          <Plus size={14} /> New Ticket
        </button>
      )}

      {/* Create form */}
      {showForm && (
        <div className="ticket-create-form">
          <input
            className="input"
            placeholder="Ticket title"
            value={newTicket.title}
            onChange={e => setNewTicket(p => ({ ...p, title: e.target.value }))}
            autoFocus
          />
          <textarea
            className="input"
            placeholder="Description (optional)"
            rows={2}
            value={newTicket.description}
            onChange={e => setNewTicket(p => ({ ...p, description: e.target.value }))}
            style={{ resize: 'vertical' }}
          />
          <div className="ticket-create-row">
            <select className="input" value={newTicket.type} onChange={e => setNewTicket(p => ({ ...p, type: e.target.value }))}>
              {TICKET_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
            </select>
            <select className="input" value={newTicket.priority} onChange={e => setNewTicket(p => ({ ...p, priority: e.target.value }))}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
            <select className="input" value={newTicket.task_id} onChange={e => setNewTicket(p => ({ ...p, task_id: e.target.value }))}>
              <option value="">Link to task...</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <select className="input" value={newTicket.assigned_to} onChange={e => setNewTicket(p => ({ ...p, assigned_to: e.target.value }))}>
              <option value="">Assign to...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="ticket-create-actions">
            <button className="btn btn-sm btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={onCreate} disabled={!newTicket.title.trim() || creating}>
              {creating ? <Loader2 size={12} className="spin" /> : <Plus size={12} />} Create
            </button>
          </div>
        </div>
      )}

      {/* Ticket list */}
      {tickets.length === 0 && !showForm ? (
        <div className="projects-empty">
          <Ticket size={36} />
          <p>No tickets yet. Create one to track bugs or issues.</p>
        </div>
      ) : (
        <div className="ticket-list">
          {tickets.map(ticket => {
            const TypeIcon = TYPE_ICONS[ticket.type] || AlertCircle
            const isExpanded = expandedId === ticket.id
            const isEditing = editingId === ticket.id
            return (
              <div key={ticket.id} className={`ticket-card type-${ticket.type}`} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                {/* Summary row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    onClick={() => setExpandedId(isExpanded ? null : ticket.id)}
                  >
                    {isExpanded
                      ? <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
                      : <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                    }
                  </div>
                  <TypeIcon size={16} style={{ color: `var(--ticket-${ticket.type})`, flexShrink: 0 }} />
                  <div className="ticket-info" style={{ cursor: 'pointer' }} onClick={() => setExpandedId(isExpanded ? null : ticket.id)}>
                    <div className="ticket-title">{ticket.title}</div>
                    <div className="ticket-meta">
                      <span className={`ticket-type-badge ticket-type-${ticket.type}`}>{ticket.type}</span>
                      <PriorityBadge priority={ticket.priority} />
                      {ticket.parent_task_title && <span>on: {ticket.parent_task_title}</span>}
                    </div>
                  </div>
                  <div className="ticket-assign-wrap">
                    {ticket.assigned_to_name && <Avatar name={ticket.assigned_to_name} size="sm" />}
                    <select
                      className="ticket-status-select"
                      value={ticket.assigned_to || ''}
                      onChange={e => onAssignChange(ticket.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </div>
                  <select
                    className="ticket-status-select"
                    value={ticket.status}
                    onChange={e => onStatusChange(ticket.id, e.target.value)}
                  >
                    {TICKET_STATUSES.map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                  <button className="ticket-delete-btn" onClick={() => onDelete(ticket.id)} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Expanded details / edit */}
                {isExpanded && (
                  <div style={{ paddingTop: 12, borderTop: '1px solid var(--card-border)', marginTop: 10 }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <input className="input" value={editData.title} onChange={e => setEditData(p => ({ ...p, title: e.target.value }))} placeholder="Title" />
                        <textarea className="input" value={editData.description} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} placeholder="Description" rows={3} style={{ resize: 'vertical' }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <select className="input" value={editData.type} onChange={e => setEditData(p => ({ ...p, type: e.target.value }))}>
                            {TICKET_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                          </select>
                          <select className="input" value={editData.priority} onChange={e => setEditData(p => ({ ...p, priority: e.target.value }))}>
                            {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                          </select>
                          <select className="input" value={editData.task_id} onChange={e => setEditData(p => ({ ...p, task_id: e.target.value }))}>
                            <option value="">Link to task...</option>
                            {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => setEditingId(null)}><X size={12} /> Cancel</button>
                          <button className="btn btn-sm btn-primary" onClick={saveEdit}><Save size={12} /> Save</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {ticket.description ? (
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <FileText size={12} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
                            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{ticket.description}</p>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No description</span>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12 }}>
                          {ticket.project_name && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <FolderKanban size={12} style={{ color: 'var(--accent)' }} />
                              <span style={{ color: 'var(--text-muted)' }}>Project:</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ticket.project_name}</span>
                            </span>
                          )}
                          {ticket.parent_task_title && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Link2 size={12} style={{ color: 'var(--accent)' }} />
                              <span style={{ color: 'var(--text-muted)' }}>Task:</span>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ticket.parent_task_title}</span>
                            </span>
                          )}
                          <span style={{ color: 'var(--text-muted)' }}>Created by: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ticket.created_by}</span></span>
                          <span style={{ color: 'var(--text-muted)' }}>Created: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{new Date(ticket.created_at).toLocaleDateString()}</span></span>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => startEditing(ticket)}>
                            <Pencil size={12} /> Edit
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
