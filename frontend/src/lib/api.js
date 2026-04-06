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

export function getFileUrl(path) {
  if (!path) return null
  if (path.startsWith('http') || path.startsWith('blob:')) return path
  // If it starts with /uploads, and we have an API_BASE, ensure we use it
  return `${API_BASE}${path}`
}

export function getPreviewProxyUrl(fileUrl) {
  if (!fileUrl) return null
  const absolute = getFileUrl(fileUrl)
  if (!absolute) return null
  // Only proxy Cloudinary URLs (keeps normal URLs untouched)
  try {
    const u = new URL(absolute)
    const host = (u.hostname || '').toLowerCase()
    const isCloudinary = host === 'res.cloudinary.com' || host.endsWith('.cloudinary.com')
    if (!isCloudinary) return absolute
    // Proxy through backend to force inline rendering and avoid CORS/download quirks
    return `${API_BASE}/api/resources/proxy?url=${encodeURIComponent(absolute)}`
  } catch {
    return absolute
  }
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

export async function apiSignupSendOtp({ name, email, password }) {
  return apiRequest('/api/auth/signup-send-otp', {
    method: 'POST',
    body: { name, email, password },
  })
}

export async function apiSignupVerifyOtp({ email, otp }) {
  return apiRequest('/api/auth/signup-verify-otp', {
    method: 'POST',
    body: { email, otp },
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

export async function apiUploadAvatar(file) {
  const formData = new FormData()
  formData.append('avatar', file)
  return apiRequest('/api/auth/avatar', {
    method: 'POST',
    body: formData,
  })
}

export async function apiForgotPassword({ email }) {
  return apiRequest('/api/auth/forgot-password', {
    method: 'POST',
    body: { email },
  })
}

export async function apiVerifyResetOtp({ email, otp }) {
  return apiRequest('/api/auth/verify-reset-otp', {
    method: 'POST',
    body: { email, otp },
  })
}

export async function apiResetPassword({ email, resetToken, newPassword }) {
  return apiRequest('/api/auth/reset-password', {
    method: 'POST',
    body: { email, resetToken, newPassword },
  })
}

export async function apiGoogleAuth({ googleId, email, name, avatar }) {
  return apiRequest('/api/auth/google', {
    method: 'POST',
    body: { googleId, email, name, avatar },
  })
}

// ═══════════════════════════════════════════
// DASHBOARD API
// ═══════════════════════════════════════════
export async function getDashboardSummary(period = 'week') {
  return apiRequest(`/api/dashboard/summary?period=${period}`)
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

export async function recalculateBadges() {
  return apiRequest('/api/achievements/recalculate', {
    method: 'POST',
  })
}

// ═══════════════════════════════════════════════
// ADMIN API
// ═══════════════════════════════════════════════
export async function getAdminDashboard() {
  return apiRequest('/api/admin/dashboard')
}

export async function getAdminUsers(params = {}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', params.page)
  if (params.limit) query.set('limit', params.limit)
  if (params.search) query.set('search', params.search)
  if (params.role) query.set('role', params.role)
  if (params.sort) query.set('sort', params.sort)
  const qs = query.toString()
  return apiRequest(`/api/admin/users${qs ? `?${qs}` : ''}`)
}

export async function updateAdminUser(id, data) {
  return apiRequest(`/api/admin/users/${id}`, { method: 'PUT', body: data })
}

export async function deleteAdminUser(id) {
  return apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' })
}

export async function getAdminResources(params = {}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', params.page)
  if (params.limit) query.set('limit', params.limit)
  if (params.search) query.set('search', params.search)
  if (params.subject) query.set('subject', params.subject)
  if (params.userId) query.set('userId', params.userId)
  const qs = query.toString()
  return apiRequest(`/api/admin/resources${qs ? `?${qs}` : ''}`)
}

export async function deleteAdminResource(id) {
  return apiRequest(`/api/admin/resources/${id}`, { method: 'DELETE' })
}

export async function toggleAdminResourceFeatured(id) {
  return apiRequest(`/api/admin/resources/${id}/featured`, { method: 'PUT' })
}

export async function getAdminRooms(params = {}) {
  const query = new URLSearchParams()
  if (params.page) query.set('page', params.page)
  if (params.limit) query.set('limit', params.limit)
  if (params.status) query.set('status', params.status)
  const qs = query.toString()
  return apiRequest(`/api/admin/rooms${qs ? `?${qs}` : ''}`)
}

export async function deleteAdminRoom(id) {
  return apiRequest(`/api/admin/rooms/${id}`, { method: 'DELETE' })
}

export async function endAdminRoom(id) {
  return apiRequest(`/api/admin/rooms/${id}/end`, { method: 'PUT' })
}

export async function promoteToAdmin(email) {
  return apiRequest('/api/admin/promote', { method: 'POST', body: { email } })
}

export async function getAdminUserDetail(id) {
  return apiRequest(`/api/admin/users/${id}/detail`)
}

export async function banAdminUser(id, reason) {
  return apiRequest(`/api/admin/users/${id}/ban`, { method: 'POST', body: { reason } })
}

export async function unbanAdminUser(id) {
  return apiRequest(`/api/admin/users/${id}/unban`, { method: 'POST' })
}

export async function warnAdminUser(id, message) {
  return apiRequest(`/api/admin/users/${id}/warn`, { method: 'POST', body: { message } })
}

export async function resetAdminUserStats(id) {
  return apiRequest(`/api/admin/users/${id}/reset-stats`, { method: 'POST' })
}

export async function updateAdminUserAiQuota(id, data) {
  return apiRequest(`/api/admin/users/${id}/ai-quota`, { method: 'PUT', body: data })
}

export async function getAdminAnalyticsAdvanced() {
  return apiRequest('/api/admin/analytics/advanced')
}

export async function getAdminAiUsageSummary() {
  return apiRequest('/api/admin/ai-usage/summary')
}

export async function getAdminModerationCases(params = {}) {
  const q = new URLSearchParams()
  if (params.status) q.set('status', params.status)
  const qs = q.toString()
  return apiRequest(`/api/admin/moderation/cases${qs ? `?${qs}` : ''}`)
}

export async function updateAdminModerationCase(id, data) {
  return apiRequest(`/api/admin/moderation/cases/${id}`, { method: 'PUT', body: data })
}

export async function createAdminModerationCase(data) {
  return apiRequest('/api/admin/moderation/cases', { method: 'POST', body: data })
}

export async function scanAdminSpam(text) {
  return apiRequest('/api/admin/moderation/scan', { method: 'POST', body: { text } })
}

export async function broadcastAdminNotification({ title, message, userIds, broadcastAll }) {
  return apiRequest('/api/admin/notifications/broadcast', {
    method: 'POST',
    body: { title, message, userIds, broadcastAll },
  })
}

export async function getAdminGamification() {
  return apiRequest('/api/admin/gamification')
}

export async function putAdminGamification(data) {
  return apiRequest('/api/admin/gamification', { method: 'PUT', body: data })
}

export async function postAdminGamificationBadge(data) {
  return apiRequest('/api/admin/gamification/badges', { method: 'POST', body: data })
}

export async function getAdminXpLeaderboard() {
  return apiRequest('/api/admin/leaderboard/xp')
}

export async function getAdminRoomLive(roomId) {
  return apiRequest(`/api/admin/rooms/${roomId}/live`)
}

export async function adminRemoveLiveUser(roomId, targetSocketId) {
  return apiRequest(`/api/admin/rooms/${roomId}/remove-live-user`, {
    method: 'POST',
    body: { targetSocketId },
  })
}

export async function requestActivityReport(body = {}) {
  return apiRequest('/api/reports/request', { method: 'POST', body })
}

export async function getMyReports() {
  return apiRequest('/api/reports/mine')
}

export async function getReportsForUser(userId) {
  return apiRequest(`/api/reports/${userId}`)
}

export async function adminGenerateReportForUser(userId, body = {}) {
  return apiRequest(`/api/admin/users/${userId}/reports`, {
    method: 'POST',
    body,
  })
}

export async function downloadReportBlob(reportId, filename) {
  const url = `${API_BASE}/api/reports/download/${reportId}`
  const token = getToken()
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Download failed (${res.status})`)
  }
  const blob = await res.blob()
  const dl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = dl
  a.download = filename || `report-${reportId}`
  a.click()
  URL.revokeObjectURL(dl)
}

