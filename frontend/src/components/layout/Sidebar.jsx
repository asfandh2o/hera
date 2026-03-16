import { NavLink } from 'react-router-dom'
import { Home, LayoutGrid, GanttChart, Users, FolderKanban, Hexagon } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/orchestrate', icon: Home, label: 'Home' },
  { to: '/board', icon: LayoutGrid, label: 'Board' },
  { to: '/timeline', icon: GanttChart, label: 'Timeline' },
  { to: '/team', icon: Users, label: 'Team' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
]

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Hexagon size={18} />
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            title={label}
          >
            <Icon size={20} className="nav-icon" />
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
