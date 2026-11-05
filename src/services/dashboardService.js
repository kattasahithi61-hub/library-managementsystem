import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export class DashboardApiUnavailableError extends Error {
  constructor() {
    super('The dashboard API is not available yet.')
    this.name = 'DashboardApiUnavailableError'
  }
}

export async function fetchDashboardData(signal) {
  let response
  try {
    response = await axios.get(`${API_BASE_URL}/dashboard`, { signal, withCredentials: true })
  } catch (error) {
    if (error.response?.status === 404) throw new DashboardApiUnavailableError()
    throw error
  }

  const data = response.data
  if (
    !data
    || typeof data !== 'object'
    || !data.stats
    || typeof data.stats !== 'object'
    || !Array.isArray(data.issuedBooks)
    || !Array.isArray(data.recentActivity)
  ) {
    throw new Error('The dashboard API returned data in an unexpected format.')
  }

  return data
}
