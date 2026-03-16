import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../api'

const ProjectContext = createContext()

export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState(null) // null = all projects
  const [loading, setLoading] = useState(true)

  const loadProjects = async () => {
    try {
      const prompts = await api.listPrompts(50)
      setProjects(prompts.filter(p => p.status === 'completed'))
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { loadProjects() }, [])

  return (
    <ProjectContext.Provider value={{
      projects,
      selectedProject,
      setSelectedProject,
      refreshProjects: loadProjects,
      loading,
    }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  return useContext(ProjectContext)
}
