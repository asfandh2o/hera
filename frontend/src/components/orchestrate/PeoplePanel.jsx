import Avatar from '../ui/Avatar'

export default function PeoplePanel({ employees }) {
  if (!employees || employees.length === 0) {
    return (
      <div className="people-panel">
        <h3 className="people-panel-title">People Involved in the project</h3>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
          No team members yet. Submit a directive to see assignments.
        </p>
      </div>
    )
  }

  return (
    <div className="people-panel">
      <h3 className="people-panel-title">People Involved in the project</h3>
      <div className="people-list">
        {employees.map(emp => (
          <div key={emp.id} className="people-card">
            <div className="people-card-header">
              <div className="people-card-info">
                <div className="people-card-role">{emp.role}</div>
                <div className="people-card-name">{emp.name}</div>
                <div className="people-status-dots">
                  <span className={`status-dot ${emp.status === 'active' ? 'dot-green' : 'dot-red'}`} />
                  <span className={`status-dot ${emp.status === 'active' ? 'dot-green' : 'dot-yellow'}`} />
                  <span className={`status-dot ${emp.status === 'active' ? 'dot-green' : 'dot-red'}`} />
                </div>
              </div>
              <Avatar name={emp.name} size="lg" />
            </div>
            <div className="people-card-footer">
              <span className="people-details-link">More Details</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
