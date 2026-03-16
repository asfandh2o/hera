const API_BASE = '';

function getToken() {
  return localStorage.getItem('hera_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('hera_token');
    localStorage.removeItem('hera_user');
    window.location.href = '/login';
    return;
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }

  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  adminLogin: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  employeeLogin: (email) =>
    request('/auth/employee-login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Employees
  listEmployees: () => request('/employees/'),
  createEmployee: (data) =>
    request('/employees/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEmployee: (id, data) =>
    request(`/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteEmployee: (id) =>
    request(`/employees/${id}`, { method: 'DELETE' }),

  // Prompts
  submitPrompt: (prompt) =>
    request('/prompts/', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
  submitPromptWithFiles: async (prompt, files) => {
    const token = getToken();
    const formData = new FormData();
    formData.append('prompt', prompt);
    files.forEach(f => formData.append('files', f));
    const res = await fetch(`${API_BASE}/prompts/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (res.status === 401) {
      localStorage.removeItem('hera_token');
      localStorage.removeItem('hera_user');
      window.location.href = '/login';
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || 'Request failed');
    }
    return res.json();
  },
  confirmAssignments: (promptId, assignments) =>
    request(`/prompts/${promptId}/confirm`, {
      method: 'POST',
      body: JSON.stringify({ assignments }),
    }),
  addTaskToPrompt: (promptId, data) =>
    request(`/prompts/${promptId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  listPrompts: (limit = 20) => request(`/prompts/?limit=${limit}`),
  getPrompt: (id) => request(`/prompts/${id}`),

  // Tasks
  listTasks: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tasks/?${qs}`);
  },
  updateTaskStatus: (id, status) =>
    request(`/tasks/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  updateTask: (id, data) =>
    request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTask: (id) =>
    request(`/tasks/${id}`, { method: 'DELETE' }),
  getTimeline: (promptId) => {
    const qs = promptId ? `?prompt_id=${promptId}` : '';
    return request(`/tasks/timeline${qs}`);
  },

  // Projects
  listProjects: (limit = 50) => request(`/projects/?limit=${limit}`),
  getProjectStats: () => request('/projects/stats'),
  getProjectDetail: (id) => request(`/projects/${id}`),

  // Tickets
  listTickets: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tickets/?${qs}`);
  },
  createTicket: (data) =>
    request('/tickets/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTicket: (id, data) =>
    request(`/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTicket: (id) =>
    request(`/tickets/${id}`, { method: 'DELETE' }),
};
