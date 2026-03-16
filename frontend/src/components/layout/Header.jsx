import { LogOut } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../ui/Avatar'

export default function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="app-header">
      <div className="header-left">
        <h1>HERA <span className="header-subtitle">– Intelligent Orchestration</span></h1>
      </div>
      <div className="header-right">
        <div className="header-user">
          <Avatar name={user?.name || user?.email || 'Admin'} size="sm" />
          <span>{user?.name || user?.email}</span>
        </div>
        <button className="logout-btn" onClick={logout}>
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </header>
  )
}
