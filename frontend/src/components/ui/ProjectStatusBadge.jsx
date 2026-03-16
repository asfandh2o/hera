import { CheckCircle2, Loader2, AlertTriangle, Circle } from 'lucide-react'

const STATUS_CONFIG = {
  completed: { icon: CheckCircle2, label: 'Completed', color: 'var(--project-completed)' },
  in_progress: { icon: Loader2, label: 'In Progress', color: 'var(--project-in-progress)' },
  behind_schedule: { icon: AlertTriangle, label: 'Behind', color: 'var(--project-behind)' },
  not_started: { icon: Circle, label: 'Not Started', color: 'var(--project-not-started)' },
}

export default function ProjectStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started
  const Icon = config.icon

  return (
    <span className={`project-status-badge project-status-${status}`}>
      <Icon size={12} />
      {config.label}
    </span>
  )
}
