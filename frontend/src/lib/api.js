// API base URL — empty in dev (Vite proxy), full URL in production
const API_BASE = import.meta.env.VITE_API_URL || ''

// ─── Token management ───
const TOKEN_KEY = 'studyhub-token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
}

// ─── Core request helper ───
export async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`
  const token = getToken()

  const config = {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  }

  // Don't stringify FormData
  if (options.body && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body)
  }

  let response
  let lastError = null

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(url, config)
      break
    } catch (error) {
      lastError = error
      const isNetworkError = error instanceof TypeError
      if (!isNetworkError || attempt === 2) {
        throw error
      }
      await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)))
    }
  }

  if (!response && lastError) throw lastError

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    if (response.status === 401) {
      removeToken()
    }
    throw new Error(error.error || error.details || `HTTP ${response.status}`)
  }

  return response.json()
}

// AI Chat
export async function sendAIMessage(message, history = []) {
  return apiRequest('/api/ai/chat', {
    method: 'POST',
    body: { message, history },
  })
}

// PDF Summarizer
export async function summarizePdf(file) {
  const formData = new FormData()
  formData.append('pdf', file)
  return apiRequest('/api/ai/summarize-pdf', {
    method: 'POST',
    body: formData,
  })
}

// Quiz Generator
export async function generateQuiz(file, numQuestions = 10, topic = '') {
  const formData = new FormData()
  if (file) formData.append('pdf', file)
  formData.append('numQuestions', numQuestions.toString())
  formData.append('topic', topic)
  return apiRequest('/api/ai/generate-quiz', {
    method: 'POST',
    body: formData,
  })
}

// Voice Assistant
export async function sendVoiceMessage(message, context = '') {
  return apiRequest('/api/ai/voice', {
    method: 'POST',
    body: { message, context },
  })
}

// Notes Enhance
export async function enhanceNotes(content, action = 'improve') {
  return apiRequest('/api/ai/enhance-notes', {
    method: 'POST',
    body: { content, action },
  })
}

// Smart Chat Reply
export async function getSmartReply(message, chatHistory = []) {
  return apiRequest('/api/ai/smart-reply', {
    method: 'POST',
    body: { message, chatHistory },
  })
}

// Health Check
export async function healthCheck() {
  return apiRequest('/api/health')
}

// Rooms / Meetings
export async function createMeeting(payload) {
  return apiRequest('/api/meetings/create', {
    method: 'POST',
    body: payload,
  })
}

export async function listMeetings() {
  return apiRequest('/api/meetings')
}

export async function getWebRtcIceConfig() {
  return apiRequest('/api/webrtc/ice')
}

// ═══════════════════════════════════════════
// AUTH API
// ═══════════════════════════════════════════
export async function apiSignup({ name, email, password }) {
  return apiRequest('/api/auth/signup', {
    method: 'POST',
    body: { name, email, password },
  })
}

export async function apiLogin({ email, password }) {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  })
}

export async function apiGetMe() {
  return apiRequest('/api/auth/me')
}

export async function apiUpdateProfile({ name, bio, institution, major }) {
  return apiRequest('/api/auth/profile', {
    method: 'PUT',
    body: { name, bio, institution, major },
  })
}

// ═══════════════════════════════════════════
// DASHBOARD API
// ═══════════════════════════════════════════
export async function getDashboardSummary() {
  return apiRequest('/api/dashboard/summary')
}

// ═══════════════════════════════════════════
// SCHEDULE API
// ═══════════════════════════════════════════
export async function getSessions() {
  return apiRequest('/api/schedule/sessions')
}
export async function createSession(data) {
  return apiRequest('/api/schedule/sessions', { method: 'POST', body: data })
}
export async function updateSession(id, data) {
  return apiRequest(`/api/schedule/sessions/${id}`, { method: 'PUT', body: data })
}
export async function deleteSession(id) {
  return apiRequest(`/api/schedule/sessions/${id}`, { method: 'DELETE' })
}

export async function getExams() {
  return apiRequest('/api/schedule/exams')
}
export async function createExam(data) {
  return apiRequest('/api/schedule/exams', { method: 'POST', body: data })
}
export async function updateExam(id, data) {
  return apiRequest(`/api/schedule/exams/${id}`, { method: 'PUT', body: data })
}
export async function deleteExam(id) {
  return apiRequest(`/api/schedule/exams/${id}`, { method: 'DELETE' })
}

export async function getEvents() {
  return apiRequest('/api/schedule/events')
}
export async function createEvent(data) {
  return apiRequest('/api/schedule/events', { method: 'POST', body: data })
}
export async function updateEvent(id, data) {
  return apiRequest(`/api/schedule/events/${id}`, { method: 'PUT', body: data })
}
export async function deleteEvent(id) {
  return apiRequest(`/api/schedule/events/${id}`, { method: 'DELETE' })
}

export async function getReminders() {
  return apiRequest('/api/schedule/reminders')
}
export async function createReminder(data) {
  return apiRequest('/api/schedule/reminders', { method: 'POST', body: data })
}
export async function updateReminder(id, data) {
  return apiRequest(`/api/schedule/reminders/${id}`, { method: 'PUT', body: data })
}
export async function deleteReminder(id) {
  return apiRequest(`/api/schedule/reminders/${id}`, { method: 'DELETE' })
}

// ═══════════════════════════════════════════
// RESOURCES API
// ═══════════════════════════════════════════
export async function getResources(params = {}) {
  const query = new URLSearchParams()
  if (params.category) query.set('category', params.category)
  if (params.semester) query.set('semester', params.semester)
  if (params.subject) query.set('subject', params.subject)
  if (params.search) query.set('search', params.search)
  if (params.sort) query.set('sort', params.sort)
  const qs = query.toString()
  return apiRequest(`/api/resources${qs ? `?${qs}` : ''}`)
}

export async function getFeaturedResources() {
  return apiRequest('/api/resources/featured')
}

export async function uploadResource(data) {
  return apiRequest('/api/resources', { method: 'POST', body: data })
}

export async function downloadResource(id) {
  return apiRequest(`/api/resources/${id}/download`, { method: 'POST' })
}

export async function getMyResources() {
  return apiRequest('/api/resources/my')
}

// ═══════════════════════════════════════════
// ACHIEVEMENTS API
// ═══════════════════════════════════════════
export async function getBadges() {
  return apiRequest('/api/achievements/badges')
}

export async function getLeaderboard() {
  return apiRequest('/api/achievements/leaderboard')
}

export async function getStudyActivity() {
  return apiRequest('/api/achievements/activity')
}

export async function logStudyActivity(date, hours) {
  return apiRequest('/api/achievements/activity', {
    method: 'POST',
    body: { date, hours },
  })
}

export async function getAchievementStats() {
  return apiRequest('/api/achievements/stats')
}

