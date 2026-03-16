import { useState, useEffect } from 'react'
import { api } from '../api'
import { CheckCircle2, XCircle, Loader2, History, Clock } from 'lucide-react'

export default function HistoryView() {
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listPrompts(30).then(setPrompts).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 20 }}>Prompt History</h2>

      {prompts.length === 0 ? (
        <div className="empty-state">
          <History size={40} />
          <p>No prompts submitted yet.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--content-bg)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prompt</th>
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tasks</th>
                <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {prompts.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--card-border)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    {p.status === 'completed' ? <CheckCircle2 size={16} color="var(--status-done)" /> :
                     p.status === 'failed' ? <XCircle size={16} color="var(--priority-critical)" /> :
                     p.status === 'pending_review' ? <Clock size={16} color="var(--priority-high)" /> :
                     <Loader2 size={16} color="var(--accent)" className="spin" />}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', maxWidth: 400 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.raw_text}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    {p.tasks_generated}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-muted)', fontSize: 12 }}>
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
