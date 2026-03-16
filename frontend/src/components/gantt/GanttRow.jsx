import Avatar from '../ui/Avatar'
import GanttBar from './GanttBar'
import { isWeekend, isToday } from '../../utils/gantt'

export default function GanttRow({ employee, tasks, days, rangeStart, onHover, onLeave, onTaskClick }) {
  return (
    <>
      {/* Employee name cell */}
      <div className="gantt-name-col gantt-employee-name">
        <Avatar name={employee.name} size="sm" />
        <span>{employee.name}</span>
      </div>

      {/* Day cells with task bars overlaid */}
      {days.map((day, i) => (
        <div
          key={i}
          className={`gantt-cell ${isWeekend(day) ? 'weekend' : ''} ${isToday(day) ? 'today' : ''}`}
        />
      ))}

      {/* Task bars rendered as absolutely positioned within the row */}
      {tasks.map(task => (
        <GanttBar
          key={task.id}
          task={task}
          rangeStart={rangeStart}
          onHover={onHover}
          onLeave={onLeave}
          onClick={onTaskClick}
        />
      ))}
    </>
  )
}
