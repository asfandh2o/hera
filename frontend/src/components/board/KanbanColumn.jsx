import TaskCard from './TaskCard'

export default function KanbanColumn({ title, tasks, color, onTaskClick }) {
  return (
    <div className="kanban-column">
      <div className="column-header">
        <div className="column-header-left">
          <div className="column-dot" style={{ background: color }} />
          <span className="column-title">{title}</span>
        </div>
        <span className="column-count">{tasks.length}</span>
      </div>
      <div className="column-body">
        {tasks.map(task => (
          <TaskCard key={task.id} task={task} onClick={onTaskClick} />
        ))}
      </div>
    </div>
  )
}
