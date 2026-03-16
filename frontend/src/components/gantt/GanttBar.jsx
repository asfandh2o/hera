import { computeTaskDates, getDayColumn } from '../../utils/gantt'

export default function GanttBar({ task, rangeStart, onHover, onLeave, onClick }) {
  const { start, end } = computeTaskDates(task)
  const startCol = getDayColumn(start, rangeStart)
  const endCol = getDayColumn(end, rangeStart)

  // Don't render if completely out of range
  if (endCol < 2 || startCol > 200) return null

  return (
    <div
      className={`gantt-bar priority-${task.priority}`}
      style={{
        gridColumn: `${Math.max(startCol, 2)} / ${Math.max(endCol, startCol + 1)}`,
      }}
      onMouseEnter={e => onHover(task, { x: e.clientX, y: e.clientY })}
      onMouseMove={e => onHover(task, { x: e.clientX, y: e.clientY })}
      onMouseLeave={onLeave}
      onClick={() => onClick(task)}
    >
      <span className="gantt-bar-title">{task.title}</span>
    </div>
  )
}
