import { useState, useEffect } from 'react'
import { api } from '../api'
import { Plus, Trash2, UserPlus } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import CapacityBar from '../components/ui/CapacityBar'

export default function TeamView() {
  const [employees, setEmployees] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', role: '', skills: '', max_capacity: 5 })
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadEmployees() }, [])

  const loadEmployees = async () => {
    try {
      const data = await api.listEmployees()
      setEmployees(data)
    } catch (e) { console.error(e) }
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.createEmployee({
        ...form,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        max_capacity: Number(form.max_capacity),
      })
      setForm({ name: '', email: '', role: '', skills: '', max_capacity: 5 })
      setShowForm(false)
      await loadEmployees()
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Remove this team member?')) return
    try {
      await api.deleteEmployee(id)
      await loadEmployees()
    } catch (e) { console.error(e) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>Team Members</h2>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{employees.length} member{employees.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          <UserPlus size={16} /> Add Member
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label>Name</label>
              <input className="input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required placeholder="John Doe" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required placeholder="john@company.com" />
            </div>
            <div className="form-group">
              <label>Role</label>
              <input className="input" value={form.role} onChange={e => setForm({...form, role: e.target.value})} required placeholder="Frontend Developer" />
            </div>
            <div className="form-group">
              <label>Max Capacity</label>
              <input className="input" type="number" value={form.max_capacity} onChange={e => setForm({...form, max_capacity: e.target.value})} min={1} max={20} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Skills (comma separated)</label>
              <input className="input" value={form.skills} onChange={e => setForm({...form, skills: e.target.value})} placeholder="React, Python, SQL, Design" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
        {employees.map(emp => (
          <div key={emp.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <Avatar name={emp.name} size="md" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{emp.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{emp.role}</div>
                </div>
              </div>
              <button onClick={() => handleDelete(emp.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                <Trash2 size={14} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>{emp.email}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
              <span>Workload</span>
              <span>{emp.pending_tasks || 0}/{emp.max_capacity}</span>
            </div>
            <CapacityBar used={emp.pending_tasks || 0} max={emp.max_capacity} />
            {emp.skills?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                {emp.skills.map(s => <span key={s} className="skill-badge">{s}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>

      {employees.length === 0 && (
        <div className="empty-state">
          <UserPlus size={40} />
          <p>No team members yet. Add your first member to get started.</p>
        </div>
      )}
    </div>
  )
}
