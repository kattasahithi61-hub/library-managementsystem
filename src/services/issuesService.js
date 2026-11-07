import axios from 'axios'
import { API_BASE_URL } from './apiConfig.js'

const issuesApi = axios.create({
  baseURL: `${API_BASE_URL}/issues`,
  withCredentials: true,
})

function notifyIssuesChanged() {
  window.dispatchEvent(new CustomEvent('library:issues-updated'))
}

export async function fetchMyIssues({ signal } = {}) {
  const response = await issuesApi.get('/my', { signal })
  if (!Array.isArray(response.data.issues)) {
    throw new Error('The issues API returned data in an unexpected format.')
  }
  return response.data.issues
}

export async function issueBook(bookId) {
  const response = await issuesApi.post('/', { bookId })
  notifyIssuesChanged()
  return response.data.issue
}

export async function returnBook(issueId) {
  const response = await issuesApi.put(`/${encodeURIComponent(issueId)}/return`)
  notifyIssuesChanged()
  return response.data.issue
}
