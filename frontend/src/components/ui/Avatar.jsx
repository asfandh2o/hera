const COLORS = [
  '#8b5cf6', '#6366f1', '#ec4899', '#f43f5e', '#f59e0b',
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7',
]

function hashName(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

export default function Avatar({ name = '', size = 'md' }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const bg = COLORS[hashName(name) % COLORS.length]

  return (
    <div
      className={`avatar avatar-${size}`}
      style={{ background: bg, color: 'white' }}
      title={name}
    >
      {initials || '?'}
    </div>
  )
}
