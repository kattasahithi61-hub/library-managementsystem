import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const authApi = axios.create({
  baseURL: `${API_BASE_URL}/auth`,
  withCredentials: true,
})

export function setAuthToken(token) {
  if (token) {
    authApi.defaults.headers.common.Authorization = `Bearer ${token}`
    return
  }
  delete authApi.defaults.headers.common.Authorization
}

export async function loginStudent(registerNumber, password) {
  const response = await authApi.post('/login', { registerNumber, password })
  return response.data
}

export async function fetchCurrentUser() {
  const response = await authApi.get('/me')
  return response.data.user
}

export async function updateCurrentUser(profile) {
  const response = await authApi.put('/me', profile)
  return response.data.user
}

export async function logoutStudent() {
  try {
    await authApi.post('/logout')
  } finally {
    setAuthToken(null)
  }
}

export async function changeAccountPassword(currentPassword, newPassword) {
  const response = await authApi.put('/change-password', { currentPassword, newPassword })
  return response.data
}

export async function verifyRecoveryDetails(registerNumber, recoveryPin) {
  const response = await authApi.post('/recovery/verify', { registerNumber, recoveryPin })
  return response.data
}

export async function resetAccountPassword(resetToken, newPassword) {
  const response = await authApi.post('/recovery/reset', { resetToken, newPassword })
  return response.data
}

export async function setAccountRecoveryPin(currentPassword, recoveryPin) {
  const response = await authApi.put('/recovery-pin', { currentPassword, recoveryPin })
  return response.data
}
