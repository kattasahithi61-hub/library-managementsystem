const configuredApiUrl = import.meta.env.VITE_API_URL || '/api'
const normalizedApiUrl = configuredApiUrl.replace(/\/+$/, '')

export const API_BASE_URL = /\/api$/i.test(normalizedApiUrl)
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`
