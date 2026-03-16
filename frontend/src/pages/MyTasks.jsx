import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import { LogOut, Hexagon, CheckCircle2, Clock, Play, Check, List, GanttChart as GanttIcon, Lock, AlertTriangle, FolderKanban, ChevronDown, ChevronRight, Ticket, Bug, AlertCircle, Lightbulb, HelpCircle, FileText, Link2, Plus, Loader2, X } from 'lucide-react'
import PriorityBadge from '../components/ui/PriorityBadge'
import Avatar from '../components/ui/Avatar'
import GanttChart from '../components/gantt/GanttChart'
import { layoutTasksSequentially } from '../utils/gantt'

function isOverdue(task) {
  if (!task.deadline || task.status === 'done') return false
  return new Date(task.deadline) < new Date()
}

function isApproaching(task) {
  if (!task.deadline || task.status === 'done') return false
  const deadline = new Date(task.deadline)
  const now = new Date()
  const hoursLeft = (deadline - now) / (1000 * 60 * 60)
  return hoursLeft > 0 && hoursLeft <= 24
}

export default function MyTasks() {
  const { user, logout } = useAuth()
  const [tasks, setTasks] = useState([])
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [statusError, setStatusError] = useState(null)
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [expandedTicketId, setExpandedTicketId] = useState(null)
  const [showTicketForm, setShowTicketForm] = useState(false)
  const [newTicket, setNewTicket] = useState({ title: '', description: '', type: 'bug', priority: 'medium', prompt_id: '', assigned_to: '' })
  const [creatingTicket, setCreatingTicket] = useState(false)

  const loadTasks = useCallback(async () => {
    try {
      const params = {}
      if (selectedProjectId) params.prompt_id = selectedProjectId
      const [taskResult, ticketResult] = await Promise.all([
        api.listTasks(params),
        api.listTickets(selectedProjectId ? { prompt_id: selectedProjectId } : {}),
      ])
      setTasks(taskResult)
      setTickets(ticketResult)
    } catch (err) {
      console.error('Failed to load tasks:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => { loadTasks() }, [loadTasks])

  const handleStatusChange = async (taskId, newStatus) => {
    setStatusError(null)
    try {
      await api.updateTaskStatus(taskId, newStatus)
      await loadTasks()
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to update status'
      if (detail.includes('blocked')) {
        setStatusError(detail)
        setTimeout(() => setStatusError(null), 5000)
      }
      console.error('Failed to update status:', err)
    }
  }

  const handleTicketStatusChange = async (ticketId, newStatus) => {
    try {
      await api.updateTicket(ticketId, { status: newStatus })
      await loadTasks()
    } catch (err) {
      console.error('Failed to update ticket:', err)
    }
  }

  // Derive colleagues from tasks (people on same projects)
  const colleagues = useMemo(() => {
    const map = {}
    for (const t of tasks) {
      if (t.assigned_to && t.assigned_to_name) {
        map[t.assigned_to] = t.assigned_to_name
      }
    }
    return Object.entries(map).map(([id, name]) => ({ id, name }))
  }, [tasks])

  const handleCreateTicket = async () => {
    if (!newTicket.title.trim() || !newTicket.prompt_id) return
    setCreatingTicket(true)
    try {
      await api.createTicket({
        prompt_id: newTicket.prompt_id,
        title: newTicket.title.trim(),
        description: newTicket.description.trim() || null,
        type: newTicket.type,
        priority: newTicket.priority,
        assigned_to: newTicket.assigned_to || null,
      })
      setNewTicket({ title: '', description: '', type: 'bug', priority: 'medium', prompt_id: '', assigned_to: '' })
      setShowTicketForm(false)
      await loadTasks()
    } catch (err) {
      console.error('Failed to create ticket:', err)
    }
    setCreatingTicket(false)
  }

  // Ticket grouping
  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress')
  const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed')

  // Derive unique projects from all tasks (unfiltered for the dropdown)
  const [allProjects, setAllProjects] = useState([])
  useEffect(() => {
    api.listTasks().then(allTasks => {
      const projectMap = {}
      for (const t of allTasks) {
        if (t.prompt_id && !projectMap[t.prompt_id]) {
          projectMap[t.prompt_id] = t.project_name || 'Untitled Project'
        }
      }
      setAllProjects(Object.entries(projectMap).map(([id, name]) => ({ id, project_name: name })))
    }).catch(() => {})
  }, [])

  const activeTasks = tasks.filter(t => t.status !== 'done')
  const doneTasks = tasks.filter(t => t.status === 'done')

  // Group active tasks by project
  const groupedTasks = useMemo(() => {
    if (selectedProjectId) return null // No grouping when filtered to one project
    const groups = {}
    for (const t of activeTasks) {
      const key = t.prompt_id || '_none'
      if (!groups[key]) {
        groups[key] = { name: t.project_name || 'Unassigned Project', tasks: [] }
      }
      groups[key].tasks.push(t)
    }
    return Object.values(groups)
  }, [activeTasks, selectedProjectId])

  // Build gantt rows — group by project when showing all, single row when filtered
  const ganttRows = useMemo(() => {
    if (tasks.length === 0) return []

    const mapTask = t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      start_date: t.start_date,
      deadline: t.deadline,
      estimated_hours: t.estimated_hours,
      skills_required: t.skills_required || [],
      blocked_by_ids: t.blocked_by_ids || [],
      is_blocked: t.is_blocked,
    })

    // When filtered to one project or only one project exists, single row
    if (selectedProjectId) {
      return [{
        employee: { id: selectedProjectId, name: allProjects.find(p => p.id === selectedProjectId)?.project_name || 'Project', role: '' },
        tasks: layoutTasksSequentially(tasks.map(mapTask)),
      }]
    }

    // Group tasks by project
    const groups = {}
    for (const t of tasks) {
      const key = t.prompt_id || '_none'
      if (!groups[key]) {
        groups[key] = { name: t.project_name || 'Unassigned', tasks: [] }
      }
      groups[key].tasks.push(mapTask(t))
    }

    return Object.entries(groups).map(([id, group]) => ({
      employee: { id, name: group.name, role: '' },
      tasks: layoutTasksSequentially(group.tasks),
    }))
  }, [tasks, selectedProjectId, allProjects])

  const renderTaskCard = (task) => {
    const overdue = isOverdue(task)
    const approaching = isApproaching(task)
    return (
      <div key={task.id} className={`card ${overdue ? 'task-overdue' : ''}`} style={{ padding: 16, borderLeft: `4px solid ${task.is_blocked ? '#ef4444' : `var(--priority-${task.priority})`}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {overdue && (
                <span className="overdue-exclamation" title={`Overdue since ${new Date(task.deadline).toLocaleDateString()}`}>!</span>
              )}
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>{task.title}</h3>
              {task.is_blocked && (
                <span className="task-blocked-badge" style={{ fontSize: 10 }}>
                  <Lock size={10} /> Blocked
                </span>
              )}
              {task.project_name && !selectedProjectId && (
                <span style={{
                  fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent)',
                  whiteSpace: 'nowrap',
                }}>
                  {task.project_name}
                </span>
              )}
            </div>
            {task.description && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{task.description}</p>
            )}
          </div>
          <PriorityBadge priority={task.priority} />
        </div>

        {task.skills_required?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
            {task.skills_required.map(s => <span key={s} className="skill-badge">{s}</span>)}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {task.estimated_hours && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {task.estimated_hours}h estimated
              </span>
            )}
            {overdue && (
              <span className="task-deadline-indicator overdue">
                <AlertTriangle size={10} /> Overdue
              </span>
            )}
            {approaching && !overdue && (
              <span className="task-deadline-indicator approaching">
                <Clock size={10} /> Due soon
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(task.status === 'pending' || task.status === 'assigned') && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleStatusChange(task.id, 'in_progress')}
                disabled={task.is_blocked}
                title={task.is_blocked ? 'Task is blocked by dependencies' : 'Start task'}
              >
                {task.is_blocked ? <Lock size={12} /> : <Play size={12} />}
                {task.is_blocked ? 'Blocked' : 'Start'}
              </button>
            )}
            {task.status === 'in_progress' && (
              <button className="btn btn-sm" style={{ background: 'var(--status-done)', color: 'white', border: 'none' }} onClick={() => handleStatusChange(task.id, 'done')}>
                <Check size={12} /> Done
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--content-bg)' }}>
      {/* Header */}
      <header style={{
        height: 56,
        background: 'rgba(15, 15, 25, 0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(139, 92, 246, 0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Hexagon size={15} />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '0.5px' }}>HERA</span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 400 }}>My Tasks</span>
        </div>
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.7)', cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.color = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
        >
          <LogOut size={13} /> Logout
        </button>
      </header>

      {/* Content */}
      <div style={{ padding: 24, maxWidth: view === 'timeline' ? '100%' : 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
              Hi, {user?.email?.split('@')[0]}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              You have {activeTasks.length} active task{activeTasks.length !== 1 ? 's' : ''}
              {allProjects.length > 1 ? ` across ${allProjects.length} projects` : ''}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Project filter */}
            {allProjects.length > 0 && (
              <div className="project-selector">
                <FolderKanban size={14} style={{ color: 'var(--accent)' }} />
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className="project-dropdown"
                >
                  <option value="">All Projects</option>
                  {allProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.project_name}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="project-chevron" />
              </div>
            )}

            {/* View toggle */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 3 }}>
              <button
                className={`btn btn-sm ${view === 'list' ? 'btn-primary' : ''}`}
                style={view !== 'list' ? { background: 'transparent', border: 'none', color: 'var(--text-muted)' } : {}}
                onClick={() => setView('list')}
              >
                <List size={14} /> List
              </button>
              <button
                className={`btn btn-sm ${view === 'timeline' ? 'btn-primary' : ''}`}
                style={view !== 'timeline' ? { background: 'transparent', border: 'none', color: 'var(--text-muted)' } : {}}
                onClick={() => setView('timeline')}
              >
                <GanttIcon size={14} /> Timeline
              </button>
            </div>
          </div>
        </div>

        {statusError && (
          <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, fontSize: 13, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={14} /> {statusError}
          </div>
        )}

        {/* Tickets section — always visible at top */}
        {!loading && (
          <div style={{
            marginBottom: 20,
            borderRadius: 10,
            border: openTickets.length > 0 ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--card-border)',
            background: openTickets.length > 0 ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.06), rgba(245, 158, 11, 0.04))' : 'var(--card-bg)',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: 8,
              borderBottom: (openTickets.length > 0 || showTicketForm) ? '1px solid rgba(239, 68, 68, 0.12)' : 'none',
              background: openTickets.length > 0 ? 'rgba(239, 68, 68, 0.05)' : 'transparent',
            }}>
              <Ticket size={14} style={{ color: openTickets.length > 0 ? '#ef4444' : 'var(--text-muted)' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                {openTickets.length > 0
                  ? <>{openTickets.length} Open Ticket{openTickets.length !== 1 ? 's' : ''} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>assigned to you</span></>
                  : 'Tickets'
                }
              </span>
              {!showTicketForm && (
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '3px 10px', fontSize: 11 }}
                  onClick={() => setShowTicketForm(true)}
                >
                  <Plus size={11} /> Report Ticket
                </button>
              )}
            </div>

            {/* Inline create form */}
            {showTicketForm && (
              <div style={{ padding: '12px 16px', borderBottom: openTickets.length > 0 ? '1px solid rgba(239, 68, 68, 0.08)' : 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  className="input"
                  placeholder="What's the issue?"
                  value={newTicket.title}
                  onChange={e => setNewTicket(p => ({ ...p, title: e.target.value }))}
                  autoFocus
                  style={{ fontSize: 13 }}
                />
                <textarea
                  className="input"
                  placeholder="Description (optional)"
                  rows={2}
                  value={newTicket.description}
                  onChange={e => setNewTicket(p => ({ ...p, description: e.target.value }))}
                  style={{ resize: 'vertical', fontSize: 12 }}
                />
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <select className="input" style={{ flex: 1, minWidth: 100, fontSize: 12 }} value={newTicket.prompt_id} onChange={e => setNewTicket(p => ({ ...p, prompt_id: e.target.value }))}>
                    <option value="">Project *</option>
                    {allProjects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                  </select>
                  <select className="input" style={{ flex: 1, minWidth: 80, fontSize: 12 }} value={newTicket.type} onChange={e => setNewTicket(p => ({ ...p, type: e.target.value }))}>
                    {['bug', 'issue', 'improvement', 'question'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                  </select>
                  <select className="input" style={{ flex: 1, minWidth: 80, fontSize: 12 }} value={newTicket.priority} onChange={e => setNewTicket(p => ({ ...p, priority: e.target.value }))}>
                    {['critical', 'high', 'medium', 'low'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                  <select className="input" style={{ flex: 1, minWidth: 100, fontSize: 12 }} value={newTicket.assigned_to} onChange={e => setNewTicket(p => ({ ...p, assigned_to: e.target.value }))}>
                    <option value="">Assign to...</option>
                    {colleagues.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button className="btn btn-sm" style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-secondary)', fontSize: 11 }} onClick={() => setShowTicketForm(false)}>
                    <X size={11} /> Cancel
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ background: 'var(--accent)', color: 'white', border: 'none', fontSize: 11, opacity: (!newTicket.title.trim() || !newTicket.prompt_id) ? 0.5 : 1 }}
                    onClick={handleCreateTicket}
                    disabled={!newTicket.title.trim() || !newTicket.prompt_id || creatingTicket}
                  >
                    {creatingTicket ? <Loader2 size={11} className="spin" /> : <Plus size={11} />} Create
                  </button>
                </div>
              </div>
            )}

            {/* Open ticket rows */}
            {openTickets.map((ticket, i) => {
              const TypeIcon = TYPE_ICONS[ticket.type] || AlertCircle
              const action = TICKET_STATUS_ACTIONS[ticket.status]
              const isExpanded = expandedTicketId === ticket.id
              return (
                <div key={ticket.id} style={{
                  borderTop: (i > 0 || showTicketForm) ? '1px solid rgba(239, 68, 68, 0.08)' : 'none',
                }}>
                  <div
                    onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                    style={{
                      padding: '10px 16px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {isExpanded
                      ? <ChevronDown size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      : <ChevronRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    }
                    <TypeIcon size={14} style={{ color: `var(--ticket-${ticket.type})`, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ticket.title}
                    </span>
                    <span className={`ticket-type-badge ticket-type-${ticket.type}`}>{ticket.type}</span>
                    {ticket.priority && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
                        background: `rgba(var(--priority-${ticket.priority}-rgb, 139, 92, 246), 0.15)`,
                        color: `var(--priority-${ticket.priority})`,
                        textTransform: 'uppercase', letterSpacing: '0.3px',
                      }}>{ticket.priority}</span>
                    )}
                    {action && (
                      <button
                        className="btn btn-sm"
                        style={{ background: action.color, color: 'white', border: 'none', padding: '3px 10px', fontSize: 11 }}
                        onClick={(e) => { e.stopPropagation(); handleTicketStatusChange(ticket.id, action.next) }}
                      >
                        <action.icon size={11} /> {action.label}
                      </button>
                    )}
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '0 16px 14px 53px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ticket.description && (
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                          <FileText size={12} style={{ color: 'var(--text-muted)', marginTop: 2, flexShrink: 0 }} />
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{ticket.description}</p>
                        </div>
                      )}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 12 }}>
                        {ticket.project_name && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <FolderKanban size={12} style={{ color: 'var(--accent)' }} />
                            <span style={{ color: 'var(--text-muted)' }}>Project:</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ticket.project_name}</span>
                          </div>
                        )}
                        {ticket.parent_task_title && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Link2 size={12} style={{ color: 'var(--accent)' }} />
                            <span style={{ color: 'var(--text-muted)' }}>Task:</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ticket.parent_task_title}</span>
                          </div>
                        )}
                        {ticket.created_by && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Reported by:</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{ticket.created_by}</span>
                          </div>
                        )}
                      </div>
                      {!ticket.description && !ticket.parent_task_title && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No additional details provided.</span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
        ) : view === 'timeline' ? (
          <GanttChart rows={ganttRows} nameLabel="Project" />
        ) : (
          <>
            {activeTasks.length === 0 && (
              <div className="empty-state">
                <CheckCircle2 size={40} />
                <p>All caught up! No tasks assigned to you.</p>
              </div>
            )}

            {/* Grouped by project when showing all */}
            {groupedTasks && groupedTasks.length > 1 ? (
              groupedTasks.map((group, gi) => (
                <div key={gi} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <FolderKanban size={14} style={{ color: 'var(--accent)' }} />
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {group.name}
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({group.tasks.length})</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {group.tasks.map(renderTaskCard)}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {activeTasks.map(renderTaskCard)}
              </div>
            )}

            {doneTasks.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                  Completed ({doneTasks.length})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {doneTasks.slice(0, 5).map(task => (
                    <div key={task.id} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, opacity: 0.6 }}>
                      <CheckCircle2 size={14} color="var(--status-done)" />
                      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{task.title}</span>
                      {task.project_name && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{task.project_name}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}


const TYPE_ICONS = {
  bug: Bug,
  issue: AlertCircle,
  improvement: Lightbulb,
  question: HelpCircle,
}

const TICKET_STATUS_ACTIONS = {
  open: { label: 'Start', next: 'in_progress', icon: Play, color: 'var(--accent)' },
  in_progress: { label: 'Resolve', next: 'resolved', icon: Check, color: 'var(--status-done)' },
}
