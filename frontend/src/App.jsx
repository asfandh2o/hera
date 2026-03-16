import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ProjectProvider } from './context/ProjectContext'
import AppShell from './components/layout/AppShell'
import Login from './pages/Login'
import BoardView from './pages/BoardView'
import TimelineView from './pages/TimelineView'
import TeamView from './pages/TeamView'
import OrchestrateView from './pages/OrchestrateView'
import ProjectsView from './pages/ProjectsView'
import ProjectDetailView from './pages/ProjectDetailView'
import MyTasks from './pages/MyTasks'

function PrivateRoute({ children, requiredRole }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" />
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={user.role === 'admin' ? '/board' : '/my-tasks'} />
  }
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={user.role === 'admin' ? '/board' : '/my-tasks'} /> : <Login />} />

      {/* Admin layout with sidebar */}
      <Route element={<PrivateRoute requiredRole="admin"><ProjectProvider><AppShell /></ProjectProvider></PrivateRoute>}>
        <Route path="/board" element={<BoardView />} />
        <Route path="/timeline" element={<TimelineView />} />
        <Route path="/team" element={<TeamView />} />
        <Route path="/orchestrate" element={<OrchestrateView />} />
        <Route path="/projects" element={<ProjectsView />} />
        <Route path="/projects/:id" element={<ProjectDetailView />} />
      </Route>

      {/* Employee view */}
      <Route path="/my-tasks" element={<PrivateRoute requiredRole="employee"><MyTasks /></PrivateRoute>} />

      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
