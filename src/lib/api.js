// API base URL - uses Vite proxy in dev, direct URL in production
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5000')
  : ''

async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`

  const config = {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  }

  // Don't stringify FormData
  if (options.body && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body)
  }

  const response = await fetch(url, config)

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
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
