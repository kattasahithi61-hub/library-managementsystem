import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const adminStudentsApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

export async function fetchAdminStudents({ search = '', signal } = {}) {
  const response = await adminStudentsApi.get('/admin/students', {
    signal,
    params: search.trim() ? { search: search.trim() } : {},
  })
  return response.data.students
}

export async function fetchAdminStudent(id) {
  const response = await adminStudentsApi.get(`/admin/students/${encodeURIComponent(id)}`)
  return response.data
}

export async function updateAdminStudentStatus(id, active) {
  const response = await adminStudentsApi.put(
    `/admin/students/${encodeURIComponent(id)}/status`,
    { active },
  )
  return response.data
}
