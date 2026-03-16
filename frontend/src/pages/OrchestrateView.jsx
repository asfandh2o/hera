import { useState, useEffect } from 'react'
import { api } from '../api'
import { useProject } from '../context/ProjectContext'
import { Hexagon, AlertCircle } from 'lucide-react'
import SystemLog from '../components/orchestrate/SystemLog'
import PeoplePanel from '../components/orchestrate/PeoplePanel'
import ChatInput from '../components/orchestrate/ChatInput'
import TaskReviewModal from '../components/orchestrate/TaskReviewModal'

export default function OrchestrateView() {
  const { refreshProjects } = useProject()
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState('')
  const [employees, setEmployees] = useState([])
  const [assignments, setAssignments] = useState({})
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [files, setFiles] = useState([])

  useEffect(() => {
    api.listEmployees().then(setEmployees).catch(() => {})
  }, [])

  const handleSubmit = async () => {
    if ((!prompt.trim() && files.length === 0) || loading) return
    setLoading(true)
    setError('')
    setResult(null)
    setConfirmed(false)

    try {
      let data
      if (files.length > 0) {
        data = await api.submitPromptWithFiles(prompt || 'Create a project plan based on the uploaded documentation.', files)
      } else {
        data = await api.submitPrompt(prompt)
      }
      setResult(data)
      setPrompt('')
      setFiles([])

      // Pre-fill assignments with LLM suggestions
      const initial = {}
      for (const task of data.tasks || []) {
        initial[task.id] = task.suggested_employee_id || ''
      }
      setAssignments(initial)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!result) return
    setConfirming(true)
    setError('')

    try {
      const assignmentList = Object.entries(assignments).map(([task_id, employee_id]) => ({
        task_id,
        employee_id: employee_id || null,
      }))
      await api.confirmAssignments(result.id, assignmentList)
      setConfirmed(true)
      setShowReviewModal(false)
      refreshProjects()
    } catch (err) {
      setError(err.message)
    } finally {
      setConfirming(false)
    }
  }

  const handleDeleteTask = async (taskId) => {
    try {
      await api.deleteTask(taskId)
      setResult(prev => ({
        ...prev,
        tasks: prev.tasks.filter(t => t.id !== taskId),
      }))
      setAssignments(prev => {
        const next = { ...prev }
        delete next[taskId]
        return next
      })
    } catch (err) {
      console.error('Failed to delete task:', err)
    }
  }

  const handleAddTask = async (taskData) => {
    const newTask = await api.addTaskToPrompt(result.id, taskData)
    setResult(prev => ({
      ...prev,
      tasks: [...prev.tasks, newTask],
    }))
    setAssignments(prev => ({
      ...prev,
      [newTask.id]: taskData.assigned_to || '',
    }))
  }

  const handleAssignmentChange = (taskId, empId) => {
    setAssignments(prev => ({ ...prev, [taskId]: empId }))
  }

  const involvedEmployees = result
    ? employees.filter(emp =>
        Object.values(assignments).some(id => String(id) === String(emp.id))
      )
    : employees

  return (
    <div className="orchestrate-layout">
      <div className="orchestrate-main">
        {!result && !loading && !error && (
          <div className="orchestrate-empty">
            <div className="orchestrate-empty-icon">
              <Hexagon size={28} color="var(--accent)" />
            </div>
            <h3>Ready to Orchestrate</h3>
            <p>Describe your initiative below. HERA will analyze it, create tracks, assign team members, and prepare a sprint plan for your review.</p>
          </div>
        )}

        {loading && (
          <div className="orchestrate-loading">
            <div className="spinner" style={{ width: 28, height: 28 }} />
            <p>Analyzing directive and allocating resources...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: 20 }}>
            <div className="card" style={{ padding: 16, borderLeft: '4px solid var(--priority-critical)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--priority-critical)' }}>
                <AlertCircle size={16} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{error}</span>
              </div>
            </div>
          </div>
        )}

        {result && (
          <SystemLog
            llmResponse={result.llm_response}
            tasks={result.tasks}
            confirmed={confirmed}
            onOpenReview={() => setShowReviewModal(true)}
          />
        )}
      </div>

      <div className="orchestrate-people">
        <PeoplePanel employees={involvedEmployees} result={result} />
      </div>

      <div className="orchestrate-chat-bar">
        <ChatInput
          value={prompt}
          onChange={setPrompt}
          onSubmit={handleSubmit}
          loading={loading}
          files={files}
          onFilesChange={setFiles}
        />
      </div>

      {showReviewModal && result && (
        <TaskReviewModal
          projectName={result.project_name || result.llm_response?.project_name}
          tasks={result.tasks}
          employees={employees}
          assignments={assignments}
          onAssignmentChange={handleAssignmentChange}
          onDeleteTask={handleDeleteTask}
          onAddTask={handleAddTask}
          onConfirm={handleConfirm}
          onClose={() => setShowReviewModal(false)}
          confirming={confirming}
        />
      )}
    </div>
  )
}
