import { useRef } from 'react'
import { Send, Hexagon, Loader2, Paperclip, X, FileText } from 'lucide-react'

const ACCEPTED_TYPES = '.pdf,.docx,.doc,.txt,.md,.csv'

export default function ChatInput({ value, onChange, onSubmit, loading, files = [], onFilesChange }) {
  const fileInputRef = useRef(null)

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if ((value.trim() || files.length > 0) && !loading) onSubmit()
    }
  }

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || [])
    if (selected.length > 0 && onFilesChange) {
      onFilesChange([...files, ...selected])
    }
    e.target.value = ''
  }

  const removeFile = (index) => {
    if (onFilesChange) {
      onFilesChange(files.filter((_, i) => i !== index))
    }
  }

  return (
    <div>
      {/* Attached files */}
      {files.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 16px 0',
          marginBottom: -4,
        }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 6,
              background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.25)',
              fontSize: 12, color: 'var(--accent)',
            }}>
              <FileText size={12} />
              <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </span>
              <button
                onClick={() => removeFile(i)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 0, display: 'flex',
                }}
                title="Remove file"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="chat-input-bar">
        <div className="chat-input-icon">
          <Hexagon size={20} />
        </div>
        <input
          type="text"
          className="chat-input-field"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={files.length > 0 ? "Add a directive for the uploaded docs..." : "HERA - The Project Manager that never sleeps."}
          disabled={loading}
        />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        {/* Attach button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          title="Attach project documentation (PDF, DOCX, TXT)"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: files.length > 0 ? 'var(--accent)' : 'var(--text-muted)',
            padding: '4px 8px', display: 'flex', alignItems: 'center',
            opacity: loading ? 0.5 : 1,
          }}
        >
          <Paperclip size={18} />
        </button>

        <button
          className="chat-send-btn"
          onClick={onSubmit}
          disabled={loading || (!value.trim() && files.length === 0)}
        >
          {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  )
}
