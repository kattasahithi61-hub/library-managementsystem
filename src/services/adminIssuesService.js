import axios from 'axios'
import { API_BASE_URL } from './apiConfig.js'

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
