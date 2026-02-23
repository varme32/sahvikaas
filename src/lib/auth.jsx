import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AuthContext = createContext(null)

// ─── Local "database" in localStorage (easy swap for MongoDB later) ───
const USERS_KEY = 'studyhub-users'
const CURRENT_USER_KEY = 'studyhub-current-user'
const ROOMS_KEY = 'studyhub-rooms'

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || [] }
  catch { return [] }
}
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function getRooms() {
  try { return JSON.parse(localStorage.getItem(ROOMS_KEY)) || [] }
  catch { return [] }
}
function saveRooms(rooms) {
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms))
}

// ─── Provider ─────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Hydrate on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CURRENT_USER_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Verify user still exists in the "database"
        const users = getUsers()
        const found = users.find(u => u.id === parsed.id)
        if (found) setUser(found)
        else localStorage.removeItem(CURRENT_USER_KEY)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  const signup = useCallback(({ name, email, password }) => {
    const users = getUsers()
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { ok: false, error: 'An account with this email already exists.' }
    }
    const newUser = {
      id: 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password, // plain text for now — hash when you add MongoDB
      avatar: null,
      bio: '',
      institution: '',
      major: '',
      joinedAt: new Date().toISOString(),
    }
    users.push(newUser)
    saveUsers(users)
    const { password: _, ...safe } = newUser
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safe))
    setUser(safe)
    // Also store the username in sessionStorage so StudyRoom picks it up
    sessionStorage.setItem('studyhub-username', safe.name)
    return { ok: true, user: safe }
  }, [])

  const login = useCallback(({ email, password }) => {
    const users = getUsers()
    const found = users.find(
      u => u.email.toLowerCase() === email.toLowerCase().trim() && u.password === password
    )
    if (!found) return { ok: false, error: 'Invalid email or password.' }
    const { password: _, ...safe } = found
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safe))
    setUser(safe)
    sessionStorage.setItem('studyhub-username', safe.name)
    return { ok: true, user: safe }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(CURRENT_USER_KEY)
    sessionStorage.removeItem('studyhub-username')
    setUser(null)
  }, [])

  const updateProfile = useCallback((updates) => {
    if (!user) return { ok: false, error: 'Not logged in.' }
    const users = getUsers()
    const idx = users.findIndex(u => u.id === user.id)
    if (idx === -1) return { ok: false, error: 'User not found.' }

    // Apply updates
    const updatedUser = { ...users[idx], ...updates }
    // If name changed, also check for conflicts? (skip for simplicity)
    users[idx] = updatedUser
    saveUsers(users)

    const { password: _, ...safe } = updatedUser
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(safe))
    setUser(safe)
    sessionStorage.setItem('studyhub-username', safe.name)
    return { ok: true, user: safe }
  }, [user])

  // ─── Room helpers (local "DB" for rooms) ────────────────────
  const createRoom = useCallback(({ name, subject, privacy, audio, video }) => {
    if (!user) return { ok: false, error: 'Not logged in.' }
    const rooms = getRooms()
    const roomId = 'room_' + Math.random().toString(36).substr(2, 9)
    const room = {
      id: roomId,
      name: name.trim(),
      subject: subject.trim(),
      privacy,
      audio,
      video,
      createdBy: user.id,
      creatorName: user.name,
      createdAt: new Date().toISOString(),
      participants: [],
    }
    rooms.push(room)
    saveRooms(rooms)
    return { ok: true, room }
  }, [user])

  const getMyRooms = useCallback(() => {
    if (!user) return []
    return getRooms().filter(r => r.createdBy === user.id)
  }, [user])

  const getAllRooms = useCallback(() => {
    return getRooms()
  }, [])

  const value = {
    user,
    loading,
    signup,
    login,
    logout,
    updateProfile,
    createRoom,
    getMyRooms,
    getAllRooms,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
