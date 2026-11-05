import { useCallback, useEffect, useMemo, useState } from 'react'
import AuthContext from './auth-context.js'
import {
  fetchCurrentUser,
  loginStudent,
  logoutStudent,
  setAuthToken,
} from '../services/authService.js'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetchCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch((error) => {
        if (active && error.response?.status !== 401) {
          console.error('Unable to restore the student session.', error)
        }
      })
      .finally(() => {
        if (active) setIsLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (registerNumber, password) => {
    const result = await loginStudent(registerNumber, password)
    if (!result.token || !result.user) {
      throw new Error('The login API returned an invalid response.')
    }
    setAuthToken(result.token)
    setUser(result.user)
    return result.user
  }, [])

  const signOut = useCallback(async () => {
    try {
      await logoutStudent()
    } finally {
      setUser(null)
    }
  }, [])

  const updateUser = useCallback((updatedUser) => {
    setUser(updatedUser)
  }, [])

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    signIn,
    signOut,
    updateUser,
  }), [user, isLoading, signIn, signOut, updateUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
