export default function CapacityBar({ used, max }) {
  const pct = max > 0 ? Math.min((used / max) * 100, 100) : 0
  const color = pct >= 90 ? 'var(--priority-critical)'
    : pct >= 60 ? 'var(--priority-high)'
    : 'var(--accent)'

  return (
    <div className="capacity-bar">
      <div
        className="capacity-bar-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}
