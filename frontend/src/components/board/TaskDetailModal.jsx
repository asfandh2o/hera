import { useState } from 'react'
import { X, Trash2, Lock, AlertTriangle } from 'lucide-react'
import { api } from '../../api'
import PriorityBadge from '../ui/PriorityBadge'
import StatusBadge from '../ui/StatusBadge'

export default function TaskDetailModal({ task, employees, allTasks = [], onClose, onSave }) {
  const [form, setForm] = useState({
    status: task.status,
    priority: task.priority,
    assigned_to: task.assigned_to || '',
    start_date: task.start_date ? task.start_date.slice(0, 10) : '',
    deadline: task.deadline ? task.deadline.slice(0, 10) : '',
    estimated_hours: task.estimated_hours || '',
    blocked_by_ids: task.blocked_by_ids || [],
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Available tasks for dependency selector (same project, exclude self and tasks that depend on this one)
  const availableDeps = allTasks.filter(t =>
    t.id !== task.id &&
    !(t.blocked_by_ids || []).includes(task.id)
  )

  const blockerNames = (task.blocked_by_ids || [])
    .map(id => allTasks.find(t => t.id === id))
    .filter(Boolean)
    .filter(t => t.status !== 'done')
    .map(t => t.title)

  const isOverdue = task.deadline && task.status !== 'done' && new Date(task.deadline) < new Date()

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const data = { ...form }
      if (data.start_date) data.start_date = new Date(data.start_date).toISOString()
      else delete data.start_date
      if (data.deadline) data.deadline = new Date(data.deadline).toISOString()
      else delete data.deadline
      if (data.estimated_hours) data.estimated_hours = Number(data.estimated_hours)
      else delete data.estimated_hours
      if (!data.assigned_to) delete data.assigned_to

      await api.updateTask(task.id, data)
      onSave()
    } catch (e) {
      const detail = e?.response?.data?.detail || e?.message || 'Save failed'
      setSaveError(detail)
      console.error(e)
    }
    setSaving(false)
  }

  const handleDepToggle = (depId) => {
    setForm(prev => {
      const current = prev.blocked_by_ids || []
      if (current.includes(depId)) {
        return { ...prev, blocked_by_ids: current.filter(id => id !== depId) }
      } else {
        return { ...prev, blocked_by_ids: [...current, depId] }
      }
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{task.title}</h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {task.is_blocked && blockerNames.length > 0 && (
            <div className="blocked-banner">
              <Lock size={14} />
              <span>Blocked by: {blockerNames.join(', ')}</span>
            </div>
          )}

          {isOverdue && (
            <div className="overdue-banner">
              <AlertTriangle size={14} />
              <span>This task is overdue (deadline: {new Date(task.deadline).toLocaleDateString()})</span>
            </div>
          )}

          {task.description && (
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
              {task.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <PriorityBadge priority={task.priority} />
            <StatusBadge status={task.status} />
          </div>

          {task.assignment_reason && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, padding: '10px 12px', background: 'var(--content-bg)', borderRadius: 8, fontStyle: 'italic' }}>
              {task.assignment_reason}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Status</label>
              <select className="input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select className="input" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>Assigned To</label>
              <select className="input" value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})}>
                <option value="">Unassigned</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Estimated Hours</label>
              <input className="input" type="number" value={form.estimated_hours} onChange={e => setForm({...form, estimated_hours: e.target.value})} min={1} />
            </div>
            <div className="form-group">
              <label>Start Date</label>
              <input className="input" type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Deadline</label>
              <input className="input" type="date" value={form.deadline} onChange={e => setForm({...form, deadline: e.target.value})} />
            </div>
          </div>

          {/* Dependency selector */}
          {availableDeps.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Depends On (blocked by)
              </label>
              <div className="dependency-selector">
                {availableDeps.map(t => (
                  <label key={t.id} className={`dependency-option ${form.blocked_by_ids.includes(t.id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.blocked_by_ids.includes(t.id)}
                      onChange={() => handleDepToggle(t.id)}
                    />
                    <span className="dep-title">{t.title}</span>
                    <StatusBadge status={t.status} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {task.skills_required?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Skills Required</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {task.skills_required.map(s => <span key={s} className="skill-badge">{s}</span>)}
              </div>
            </div>
          )}

          {saveError && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, fontSize: 12, color: '#ef4444' }}>
              {saveError}
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <div>
            {!confirmDelete ? (
              <button
                className="btn"
                style={{ color: 'var(--priority-critical)', border: '1px solid var(--priority-critical)', background: 'transparent' }}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={14} /> Delete
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--priority-critical)' }}>Are you sure?</span>
                <button
                  className="btn"
                  style={{ background: 'var(--priority-critical)', color: 'white', border: 'none' }}
                  onClick={async () => {
                    await api.deleteTask(task.id)
                    onSave()
                  }}
                >
                  Yes, delete
                </button>
                <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>No</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
