import { AlertTriangle, ClipboardList } from 'lucide-react'

export default function SystemLog({ llmResponse, tasks, confirmed, onOpenReview }) {
  // Fallback for old-format llm_response or missing data
  if (!llmResponse || !llmResponse.tracks) {
    return (
      <div className="system-log">
        <h2 className="system-log-header">HERA SYSTEM LOG: Resource Allocation & Task Routing</h2>
        <div className="system-log-meta">
          <div className="meta-row">
            <span className="meta-label">Project:</span>
            <span className="meta-value">{llmResponse?.project_name || 'Processing...'}</span>
          </div>
        </div>
        {tasks?.map(task => (
          <div key={task.id} className="system-log-subteam" style={{ marginLeft: 0 }}>
            <h4 className="subteam-name">{task.title}</h4>
            <div className="subteam-task">
              <span className="task-desc">Task: {task.description}</span>
            </div>
          </div>
        ))}
        {!confirmed && tasks?.length > 0 && (
          <div className="system-log-confirm">
            <p>Ready to review and assign?</p>
            <button className="btn-confirm-sprint" onClick={onOpenReview}>
              <ClipboardList size={16} /> Review & Start Project
            </button>
          </div>
        )}
      </div>
    )
  }

  const { project_name, narrative, source_material, staff_allocation_percent, tracks, orchestration_note } = llmResponse

  return (
    <div className="system-log">
      <h2 className="system-log-header">
        <span className="log-icon">&#9670;</span> HERA SYSTEM LOG: Resource Allocation & Task Routing
      </h2>

      <div className="system-log-meta">
        <div className="meta-row">
          <span className="meta-label">Project:</span>
          <span className="meta-value">{project_name}</span>
        </div>
        {source_material && (
          <div className="meta-row">
            <span className="meta-label">Source Material:</span>
            <span className="meta-value">{source_material}</span>
          </div>
        )}
        {staff_allocation_percent && (
          <div className="meta-row">
            <span className="meta-label">Staff Allocation:</span>
            <span className="meta-value">{staff_allocation_percent}% Human Bandwidth Utilization</span>
          </div>
        )}
      </div>

      {narrative && <p className="system-log-narrative">{narrative}</p>}

      {tracks.map((track, i) => (
        <div key={i} className="system-log-track">
          <h3 className="track-header">
            {i + 1}. {track.track_name} ({track.member_count} Members)
          </h3>
          <p className="track-objective">Objective: {track.objective}</p>

          {track.sub_teams?.map((subTeam, j) => (
            <div key={j} className="system-log-subteam">
              <h4 className="subteam-name">&bull; {subTeam.sub_team_name}</h4>
              {subTeam.tasks?.map((task, k) => (
                <div key={k} className="subteam-task">
                  <span className="task-desc">Task: {task.description}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}

      {orchestration_note && (
        <div className="system-log-note">
          <AlertTriangle size={16} />
          <div>
            <strong>HERA ORCHESTRATION NOTE:</strong>
            <p>{orchestration_note}</p>
          </div>
        </div>
      )}

      {!confirmed && (
        <div className="system-log-confirm">
          <p>Ready to review and assign?</p>
          <button className="btn-confirm-sprint" onClick={onOpenReview}>
            <ClipboardList size={16} /> Review & Start Project
          </button>
        </div>
      )}

      {confirmed && (
        <div className="system-log-confirmed">
          <span>Sprint confirmed. Tasks have been assigned and are now active.</span>
        </div>
      )}
    </div>
  )
}
