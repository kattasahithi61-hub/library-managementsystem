import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const adminIssuesApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

export async function fetchAdminIssues({ search = '', status = 'all', signal } = {}) {
  const response = await adminIssuesApi.get('/admin/issues', {
    signal,
    params: {
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(status !== 'all' ? { status } : {}),
    },
  })
  return response.data.issues
}

export async function fetchAdminIssue(id) {
  const response = await adminIssuesApi.get(`/admin/issues/${encodeURIComponent(id)}`)
  return response.data.issue
}
