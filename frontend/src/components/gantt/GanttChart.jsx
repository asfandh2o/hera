import { useState } from 'react'
import { getDateRange, isWeekend, isToday, formatShortDate, computeTaskDates, getDayColumn } from '../../utils/gantt'
import Avatar from '../ui/Avatar'
import GanttTooltip from './GanttTooltip'
import { GanttChart as GanttIcon } from 'lucide-react'

const ROW_HEIGHT = 40
const BAR_HEIGHT = 28
const BAR_GAP = 4

export default function GanttChart({ rows, onTaskClick, nameLabel = 'Team Member' }) {
  const [tooltip, setTooltip] = useState({ task: null, position: null })

  if (!rows || rows.length === 0) {
    return (
      <div className="gantt-empty">
        <GanttIcon size={40} />
        <p style={{ marginTop: 12 }}>No tasks to display on the timeline.</p>
        <p style={{ fontSize: 12 }}>Go to Orchestrate to create tasks from a prompt.</p>
      </div>
    )
  }

  const { startDate, days } = getDateRange(rows)
  const dayCount = days.length

  return (
    <div className="gantt-wrapper">
      <div className="gantt-scroll">
        <div style={{ minWidth: 200 + dayCount * 48, position: 'relative' }}>

          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: `200px repeat(${dayCount}, 48px)`,
            position: 'sticky',
            top: 0,
            zIndex: 8,
            background: 'var(--card-bg)',
          }}>
            <div className="gantt-name-col gantt-name-header">{nameLabel}</div>
            {days.map((day, i) => (
              <div
                key={i}
                className={`gantt-header-cell ${isToday(day) ? 'today' : ''} ${isWeekend(day) ? 'weekend' : ''}`}
              >
                <span className="day-number">{day.getDate()}</span>
                <span className="day-name">{formatShortDate(day)}</span>
              </div>
            ))}
          </div>

          {/* Employee rows */}
          {rows.map((row, rowIdx) => {
            const rowH = ROW_HEIGHT + 8

            return (
              <div
                key={row.employee.id || `unassigned-${rowIdx}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `200px repeat(${dayCount}, 48px)`,
                  position: 'relative',
                  height: rowH,
                }}
              >
                {/* Name */}
                <div className="gantt-name-col gantt-employee-name" style={{ height: rowH }}>
                  <Avatar name={row.employee.name} size="sm" />
                  <span>{row.employee.name}</span>
                </div>

                {/* Day cells (background) */}
                {days.map((day, i) => (
                  <div
                    key={i}
                    className={`gantt-cell ${isWeekend(day) ? 'weekend' : ''} ${isToday(day) ? 'today' : ''}`}
                    style={{ height: rowH }}
                  />
                ))}

                {/* Task bars — sequential on a single row */}
                {row.tasks.map((task) => {
                  const { start, end } = computeTaskDates(task)
                  const startCol = getDayColumn(start, startDate)
                  const endCol = getDayColumn(end, startDate)
                  const clampedStart = Math.max(startCol, 2)
                  const clampedEnd = Math.max(endCol, clampedStart + 1)

                  const leftPx = (clampedStart - 2) * 48 + 200 + 4
                  const widthPx = (clampedEnd - clampedStart) * 48 - 8
                  const topPx = BAR_GAP + 2

                  const isOverdue = task.deadline && task.status !== 'done' && new Date(task.deadline) < new Date()
                  const statusClass = task.status === 'done' ? 'status-done' : task.status === 'in_progress' ? 'status-active' : task.is_blocked ? 'status-blocked' : isOverdue ? 'status-overdue' : ''

                  return (
                    <div
                      key={task.id}
                      className={`gantt-bar priority-${task.priority} ${statusClass}`}
                      style={{
                        position: 'absolute',
                        left: leftPx,
                        top: topPx,
                        height: BAR_HEIGHT,
                        width: Math.max(widthPx, 28),
                      }}
                      onMouseEnter={e => setTooltip({ task, position: { x: e.clientX, y: e.clientY } })}
                      onMouseMove={e => setTooltip({ task, position: { x: e.clientX, y: e.clientY } })}
                      onMouseLeave={() => setTooltip({ task: null, position: null })}
                      onClick={() => onTaskClick?.(task)}
                    >
                      {isOverdue && <span className="gantt-bar-overdue-icon">!</span>}
                      <span className="gantt-bar-title">{task.title}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Today line */}
          {(() => {
            const todayCol = getDayColumn(new Date(), startDate)
            if (todayCol >= 2 && todayCol <= dayCount + 1) {
              const leftPx = (todayCol - 2) * 48 + 200 + 24
              return <div className="gantt-today-line" style={{ left: leftPx }} />
            }
            return null
          })()}
        </div>
      </div>

      <GanttTooltip task={tooltip.task} position={tooltip.position} />
    </div>
  )
}
