const LABELS = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  done: 'Done',
}

export default function StatusBadge({ status }) {
  const cls = status === 'in_progress' ? 'in-progress' : status
  return (
    <span className={`badge badge-${cls}`}>
      {LABELS[status] || status}
    </span>
  )
}
