import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api'
import { Hexagon, Loader2 } from 'lucide-react'

export default function Login() {
  const [mode, setMode] = useState('admin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      let result
      if (mode === 'admin') {
        result = await api.adminLogin(email, password)
      } else {
        result = await api.employeeLogin(email)
      }

      login({ email: result.email, role: result.role, name: result.name }, result.token)
      navigate(result.role === 'admin' ? '/board' : '/my-tasks')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon"><Hexagon size={24} /></div>
          <h1>HERA</h1>
          <p>Flow Orchestrator</p>
        </div>

        <div className="login-tabs">
          <button
            className={`login-tab ${mode === 'admin' ? 'active' : ''}`}
            onClick={() => setMode('admin')}
          >
            Manager
          </button>
          <button
            className={`login-tab ${mode === 'employee' ? 'active' : ''}`}
            onClick={() => setMode('employee')}
          >
            Employee
          </button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="login-input"
          />
          {mode === 'admin' && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="login-input"
            />
          )}
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" /> : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
