export default function GanttTooltip({ task, position }) {
  if (!task || !position) return null

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Not set'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div
      className="gantt-tooltip"
      style={{ left: position.x + 12, top: position.y - 10 }}
    >
      <div className="gantt-tooltip-title">{task.title}</div>
      <div className="gantt-tooltip-row">
        <span>Priority</span>
        <span style={{ textTransform: 'capitalize' }}>{task.priority}</span>
      </div>
      <div className="gantt-tooltip-row">
        <span>Status</span>
        <span style={{ textTransform: 'capitalize' }}>{task.status?.replace('_', ' ')}</span>
      </div>
      <div className="gantt-tooltip-row">
        <span>Start</span>
        <span>{formatDate(task.start_date)}</span>
      </div>
      {task.deadline && (
        <div className="gantt-tooltip-row">
          <span>Deadline</span>
          <span>{formatDate(task.deadline)}</span>
        </div>
      )}
      {task.estimated_hours && (
        <div className="gantt-tooltip-row">
          <span>Estimate</span>
          <span>{task.estimated_hours}h</span>
        </div>
      )}
    </div>
  )
}
