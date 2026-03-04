import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiSignup, apiLogin, apiGetMe, apiUpdateProfile, setToken, getToken, removeToken } from './api'

const AuthContext = createContext(null)

const CURRENT_USER_KEY = 'studyhub-current-user'

// ─── Provider ─────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Hydrate on mount — check if token exists and validate with backend
  useEffect(() => {
    const init = async () => {
      const token = getToken()
      if (!token) {
        setLoading(false)
        return
      }
      try {
        const data = await apiGetMe()
        if (data.ok && data.user) {
          setUser(data.user)
          localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data.user))
          sessionStorage.setItem('studyhub-username', data.user.name)
        } else {
          removeToken()
          localStorage.removeItem(CURRENT_USER_KEY)
        }
      } catch {
        // Token invalid or server down — try cached user for offline
        try {
          const cached = localStorage.getItem(CURRENT_USER_KEY)
          if (cached) setUser(JSON.parse(cached))
        } catch { /* ignore */ }
      }
      setLoading(false)
    }
    init()
  }, [])

  const signup = useCallback(async ({ name, email, password }) => {
    try {
      const data = await apiSignup({ name, email, password })
      if (data.ok) {
        setToken(data.token)
        setUser(data.user)
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data.user))
        sessionStorage.setItem('studyhub-username', data.user.name)
        return { ok: true, user: data.user }
      }
      return { ok: false, error: data.error || 'Signup failed.' }
    } catch (err) {
      return { ok: false, error: err.message || 'Signup failed.' }
    }
  }, [])

  const login = useCallback(async ({ email, password }) => {
    try {
      const data = await apiLogin({ email, password })
      if (data.ok) {
        setToken(data.token)
        setUser(data.user)
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data.user))
        sessionStorage.setItem('studyhub-username', data.user.name)
        return { ok: true, user: data.user }
      }
      return { ok: false, error: data.error || 'Login failed.' }
    } catch (err) {
      return { ok: false, error: err.message || 'Invalid email or password.' }
    }
  }, [])

  const logout = useCallback(() => {
    removeToken()
    localStorage.removeItem(CURRENT_USER_KEY)
    sessionStorage.removeItem('studyhub-username')
    setUser(null)
  }, [])

  const updateProfile = useCallback(async (updates) => {
    try {
      const data = await apiUpdateProfile(updates)
      if (data.ok) {
        setUser(data.user)
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(data.user))
        sessionStorage.setItem('studyhub-username', data.user.name)
        return { ok: true, user: data.user }
      }
      return { ok: false, error: data.error || 'Update failed.' }
    } catch (err) {
      return { ok: false, error: err.message || 'Update failed.' }
    }
  }, [])

  const value = {
    user,
    loading,
    signup,
    login,
    logout,
    updateProfile,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}

