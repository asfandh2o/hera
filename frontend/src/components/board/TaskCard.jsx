import Avatar from '../ui/Avatar'
import { Clock, Lock, AlertTriangle } from 'lucide-react'

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

export default function TaskCard({ task, onClick }) {
  const overdue = isOverdue(task)
  const approaching = isApproaching(task)

  return (
    <div
      className={`task-card priority-${task.priority} ${task.is_blocked ? 'task-blocked' : ''} ${overdue ? 'task-overdue' : ''}`}
      onClick={() => onClick(task)}
    >
      {task.is_blocked && (
        <div className="task-blocked-badge">
          <Lock size={10} /> Blocked
        </div>
      )}
      <h4 className="task-card-title">{task.title}</h4>
      {task.skills_required?.length > 0 && (
        <div className="task-card-skills">
          {task.skills_required.slice(0, 3).map(s => (
            <span key={s} className="skill-badge">{s}</span>
          ))}
        </div>
      )}
      <div className="task-card-footer">
        <div className="task-card-assignee">
          {task.assigned_to_name ? (
            <>
              <Avatar name={task.assigned_to_name} size="sm" />
              <span>{task.assigned_to_name}</span>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {overdue && (
            <span className="task-deadline-indicator overdue">
              <AlertTriangle size={10} /> <strong>!</strong> Overdue
            </span>
          )}
          {approaching && !overdue && (
            <span className="task-deadline-indicator approaching">
              <Clock size={10} /> Due soon
            </span>
          )}
          {task.estimated_hours && (
            <div className="task-card-hours">
              <Clock size={12} />
              {task.estimated_hours}h
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
