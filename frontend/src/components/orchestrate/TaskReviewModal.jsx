import { useState } from 'react'
import { X, Plus, Trash2, Loader2, Clock, Users, CheckCircle } from 'lucide-react'
import PriorityBadge from '../ui/PriorityBadge'
import Avatar from '../ui/Avatar'

const PRIORITIES = ['critical', 'high', 'medium', 'low']

export default function TaskReviewModal({
  projectName,
  tasks,
  employees,
  assignments,
  onAssignmentChange,
  onDeleteTask,
  onAddTask,
  onConfirm,
  onClose,
  confirming,
}) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', estimated_hours: '', assigned_to: '' })
  const [adding, setAdding] = useState(false)

  const assignedCount = Object.values(assignments).filter(Boolean).length
  const unassignedCount = tasks.length - assignedCount

  const handleAdd = async () => {
    if (!newTask.title.trim()) return
    setAdding(true)
    try {
      await onAddTask({
        title: newTask.title.trim(),
        priority: newTask.priority,
        estimated_hours: newTask.estimated_hours ? parseInt(newTask.estimated_hours) : null,
        assigned_to: newTask.assigned_to || null,
      })
      setNewTask({ title: '', priority: 'medium', estimated_hours: '', assigned_to: '' })
      setShowAddForm(false)
    } catch (err) {
      console.error('Failed to add task:', err)
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="task-review-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>Review Tasks</h2>
            {projectName && <span className="task-review-project">{projectName}</span>}
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Summary bar */}
        <div className="task-review-summary">
          <div className="task-review-summary-item">
            <CheckCircle size={14} />
            <span><strong>{tasks.length}</strong> tasks</span>
          </div>
          <div className="task-review-summary-item task-review-summary-assigned">
            <Users size={14} />
            <span><strong>{assignedCount}</strong> assigned</span>
          </div>
          {unassignedCount > 0 && (
            <div className="task-review-summary-item task-review-summary-unassigned">
              <Clock size={14} />
              <span><strong>{unassignedCount}</strong> unassigned</span>
            </div>
          )}
        </div>

        {/* Task list */}
        <div className="task-review-list">
          {tasks.map(task => {
            const assignedId = assignments[task.id] || ''
            const assignedEmp = employees.find(e => String(e.id) === String(assignedId))

            return (
              <div key={task.id} className="task-review-row">
                <div className="task-review-row-left">
                  <PriorityBadge priority={task.priority} />
                  <div className="task-review-info">
                    {task.track_name && (
                      <span className="task-review-track">{task.track_name.replace(/ TRACK$/i, '').replace(/ MODULE$/i, '')}</span>
                    )}
                    <div className="task-review-title">{task.title}</div>
                    <div className="task-review-meta">
                      {task.skills_required?.length > 0 && (
                        <div className="task-review-skills">
                          {task.skills_required.slice(0, 3).map(s => (
                            <span key={s} className="skill-badge">{s}</span>
                          ))}
                        </div>
                      )}
                      {task.estimated_hours && (
                        <span className="task-review-hours">
                          <Clock size={11} /> {task.estimated_hours}h
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="task-review-row-right">
                  <div className="task-review-assign-wrap">
                    {assignedEmp && <Avatar name={assignedEmp.name} size="sm" />}
                    <select
                      className="task-review-select"
                      value={assignedId}
                      onChange={e => onAssignmentChange(task.id, e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    className="task-review-delete"
                    onClick={() => onDeleteTask(task.id)}
                    title="Remove task"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}

          {/* Add task section */}
          {!showAddForm ? (
            <button className="task-review-add-btn" onClick={() => setShowAddForm(true)}>
              <Plus size={14} /> Add Task
            </button>
          ) : (
            <div className="task-review-add-form">
              <input
                className="input"
                placeholder="Task title"
                value={newTask.title}
                onChange={e => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <div className="task-review-add-row">
                <select
                  className="input task-review-add-field"
                  value={newTask.priority}
                  onChange={e => setNewTask(prev => ({ ...prev, priority: e.target.value }))}
                >
                  {PRIORITIES.map(p => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
                <input
                  className="input task-review-add-field"
                  type="number"
                  placeholder="Hours"
                  min="1"
                  value={newTask.estimated_hours}
                  onChange={e => setNewTask(prev => ({ ...prev, estimated_hours: e.target.value }))}
                />
                <select
                  className="input task-review-add-field"
                  value={newTask.assigned_to}
                  onChange={e => setNewTask(prev => ({ ...prev, assigned_to: e.target.value }))}
                >
                  <option value="">Assign to...</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="task-review-add-actions">
                <button className="btn btn-sm btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
                <button className="btn btn-sm btn-primary" onClick={handleAdd} disabled={!newTask.title.trim() || adding}>
                  {adding ? <Loader2 size={12} className="spin" /> : <Plus size={12} />}
                  Add
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="task-review-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-confirm-sprint" onClick={onConfirm} disabled={confirming || tasks.length === 0}>
            {confirming ? (
              <><Loader2 size={16} className="spin" /> Starting...</>
            ) : (
              'Start Project'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
