import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { GoogleGenerativeAI } from '@google/generative-ai'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http'
import { Server as SocketServer } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// Create HTTP server for both Express and Socket.IO
const httpServer = createServer(app)
const io = new SocketServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// =============================================
// IN-MEMORY ROOM STATE STORE
// =============================================
// Each room is a fully isolated collaboration environment
const rooms = new Map()
// roomId -> {
//   id, createdBy, createdAt,
//   participants: Map<socketId, { id, name, socketId, joinedAt, audioOn, videoOn }>,
//   chatMessages: [{ id, user, userId, content, time, timestamp }],
//   tasks: [{ id, text, dueDate, completed, createdBy, createdAt }],
//   sharedNotes: [{ id, title, content, createdBy, createdAt, updatedAt }],
//   resources: [{ id, name, type, size, folderId, uploadedBy, uploadedAt }],
//   folders: [{ id, name, createdBy }],
//   points: Map<userName, { points, activities: [] }>,
// }

function getOrCreateRoom(roomId, creatorName = 'Host') {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      id: roomId,
      createdBy: creatorName,
      createdAt: new Date().toISOString(),
      participants: new Map(),
      chatMessages: [],
      tasks: [],
      sharedNotes: [],
      resources: [],
      folders: [],
      points: new Map(),
    })
  }
  return rooms.get(roomId)
}

function getParticipantsList(room) {
  return Array.from(room.participants.values()).map(p => ({
    id: p.socketId,
    name: p.name,
    socketId: p.socketId,
    joinedAt: p.joinedAt,
    audioOn: p.audioOn ?? true,
    videoOn: p.videoOn ?? true,
  }))
}

function awardPoints(room, userName, points, activity) {
  if (!room.points.has(userName)) {
    room.points.set(userName, { points: 0, activities: [] })
  }
  const entry = room.points.get(userName)
  entry.points += points
  entry.activities.push({ label: activity, points, time: new Date().toISOString() })
}

function getLeaderboard(room) {
  const entries = Array.from(room.points.entries())
    .map(([name, data]) => ({ name, points: data.points, activities: data.activities }))
    .sort((a, b) => b.points - a.points)
  return entries.map((e, i) => ({ ...e, rank: i + 1 }))
}

// Middleware
app.use(cors())
app.use(express.json({ limit: '50mb' }))

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
})
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }) // 10MB limit

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Helper: get Gemini model
function getModel(systemInstruction = '', modelName = 'gemini-2.5-flash') {
  const config = { model: modelName }
  if (systemInstruction) {
    config.systemInstruction = { parts: [{ text: systemInstruction }] }
  }
  return genAI.getGenerativeModel(config)
}

// Helper: retry with backoff for rate limits
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      const isRateLimit = err.message?.includes('429') || err.message?.includes('quota')
      if (isRateLimit && i < maxRetries - 1) {
        const delay = Math.pow(2, i + 1) * 1000 // 2s, 4s, 8s
        console.log(`Rate limited, retrying in ${delay / 1000}s... (attempt ${i + 2}/${maxRetries})`)
        await new Promise(r => setTimeout(r, delay))
      } else {
        throw err
      }
    }
  }
}

// Helper: extract text from PDF using pdf-parse
async function extractPdfText(filePath) {
  const pdfParse = (await import('pdf-parse')).default
  const dataBuffer = fs.readFileSync(filePath)
  const data = await pdfParse(dataBuffer)
  return data.text
}

// =============================================
// ROUTES
// =============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'StudyHub Backend Running' })
})

// ---- AI ASSISTANT (Chat) ----
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body
    if (!message) return res.status(400).json({ error: 'Message is required' })

    const systemPrompt = `You are an AI Study Assistant for StudyHub, a collaborative learning platform. 
You help students with:
- Explaining concepts clearly and concisely
- Solving problems step-by-step
- Providing study tips and strategies
- Answering academic questions across subjects
- Helping with homework and assignments
Be friendly, supportive, and encouraging. Use markdown formatting for better readability.
When explaining code, use code blocks. When explaining math, use clear notation.`

    const model = getModel(systemPrompt)
    
    // Build chat history for Gemini
    const chatHistory = history.map(msg => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }))

    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.7,
      },
    })

    const response = await withRetry(async () => {
      const result = await chat.sendMessage(message)
      return result.response.text()
    })

    res.json({ response })
  } catch (error) {
    console.error('AI Chat Error:', error)
    const status = error.message?.includes('429') ? 429 : 500
    const msg = status === 429 ? 'API quota exceeded. Please wait a minute and try again.' : 'Failed to get AI response'
    res.status(status).json({ error: msg, details: error.message })
  }
})

// ---- PDF SUMMARIZER ----
app.post('/api/ai/summarize-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'PDF file is required' })

    // Extract text from PDF
    const text = await extractPdfText(req.file.path)
    
    if (!text || text.trim().length < 50) {
      // Clean up file
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Could not extract sufficient text from PDF. The file may be image-based or empty.' })
    }

    // Truncate if too long (Gemini has token limits)
    const truncatedText = text.slice(0, 30000)

    const model = getModel()
    const prompt = `You are an academic document summarizer. Analyze the following PDF text and provide a comprehensive, well-structured summary.

Format your response as follows:
1. **Document Title/Topic** - Identify the main topic
2. **Key Points** - List the most important points (use bullet points)
3. **Detailed Summary** - A thorough paragraph summary
4. **Key Terms & Definitions** - Important terms mentioned
5. **Study Notes** - Quick revision points for students

Here is the document text:

${truncatedText}`

    const summary = await withRetry(async () => {
      const result = await model.generateContent(prompt)
      return result.response.text()
    })

    // Clean up uploaded file
    fs.unlinkSync(req.file.path)

    res.json({ summary, pageCount: text.length > 0 ? Math.ceil(text.length / 3000) : 0 })
  } catch (error) {
    console.error('PDF Summarize Error:', error)
    // Clean up file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    const status = error.message?.includes('429') ? 429 : 500
    const msg = status === 429 ? 'API quota exceeded. Please wait a minute and try again.' : 'Failed to summarize PDF'
    res.status(status).json({ error: msg, details: error.message })
  }
})

// ---- QUIZ GENERATOR ----
app.post('/api/ai/generate-quiz', upload.single('pdf'), async (req, res) => {
  try {
    const { numQuestions = 10, topic = '' } = req.body
    let sourceText = ''

    if (req.file) {
      sourceText = await extractPdfText(req.file.path)
      fs.unlinkSync(req.file.path)
    }

    if (!sourceText && !topic) {
      return res.status(400).json({ error: 'Upload a PDF or provide a topic' })
    }

    const truncatedText = sourceText ? sourceText.slice(0, 25000) : ''
    const model = getModel()

    const prompt = `Generate exactly ${numQuestions} multiple-choice quiz questions ${
      truncatedText 
        ? `based on the following study material:\n\n${truncatedText}` 
        : `on the topic: ${topic}`
    }

IMPORTANT: Return ONLY valid JSON with no markdown formatting or extra text. The response must be a raw JSON array.

Each question must have this exact structure:
[
  {
    "question": "The question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0,
    "explanation": "Brief explanation of why the correct answer is right"
  }
]

Rules:
- "correct" is the 0-based index of the correct option (0, 1, 2, or 3)
- Each question must have exactly 4 options
- Questions should test understanding, not just memorization
- Include a mix of easy, medium, and hard questions
- Make distractors plausible but clearly wrong
- Return ONLY the JSON array, no other text`

    const responseText = await withRetry(async () => {
      const result = await model.generateContent(prompt)
      let text = result.response.text()
      text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      return text
    })
    
    const questions = JSON.parse(responseText)

    res.json({ questions })
  } catch (error) {
    console.error('Quiz Generate Error:', error)
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    const status = error.message?.includes('429') ? 429 : 500
    const msg = status === 429 ? 'API quota exceeded. Please wait a minute and try again.' : 'Failed to generate quiz'
    res.status(status).json({ error: msg, details: error.message })
  }
})

// ---- VOICE ASSISTANT ----
app.post('/api/ai/voice', async (req, res) => {
  try {
    const { message, context = '' } = req.body
    if (!message) return res.status(400).json({ error: 'Message is required' })

    const model = getModel()
    const prompt = `You are a voice-based AI study assistant. The student said: "${message}"
${context ? `Context from their study session: ${context}` : ''}

Provide a clear, concise, and helpful response suitable for text-to-speech playback.
Keep your response conversational and under 150 words so it's easy to listen to.
If explaining concepts, break them down simply.`

    const response = await withRetry(async () => {
      const result = await model.generateContent(prompt)
      return result.response.text()
    })

    res.json({ response })
  } catch (error) {
    console.error('Voice Assistant Error:', error)
    const status = error.message?.includes('429') ? 429 : 500
    const msg = status === 429 ? 'API quota exceeded. Please wait a minute and try again.' : 'Failed to process voice request'
    res.status(status).json({ error: msg, details: error.message })
  }
})

// ---- NOTES AI ENHANCE ----
app.post('/api/ai/enhance-notes', async (req, res) => {
  try {
    const { content, action } = req.body
    if (!content) return res.status(400).json({ error: 'Content is required' })

    const model = getModel()
    let prompt = ''

    switch (action) {
      case 'summarize':
        prompt = `Summarize the following study notes into concise key points:\n\n${content}`
        break
      case 'expand':
        prompt = `Expand and elaborate on the following study notes with more detail and examples:\n\n${content}`
        break
      case 'format':
        prompt = `Reformat and organize the following study notes with proper headings, bullet points, and structure:\n\n${content}`
        break
      case 'flashcards':
        prompt = `Create flashcard-style Q&A pairs from the following notes. Format as:\nQ: [question]\nA: [answer]\n\n${content}`
        break
      default:
        prompt = `Improve and enhance the following study notes:\n\n${content}`
    }

    const enhanced = await withRetry(async () => {
      const result = await model.generateContent(prompt)
      return result.response.text()
    })

    res.json({ enhanced })
  } catch (error) {
    console.error('Notes Enhance Error:', error)
    const status = error.message?.includes('429') ? 429 : 500
    const msg = status === 429 ? 'API quota exceeded. Please wait a minute and try again.' : 'Failed to enhance notes'
    res.status(status).json({ error: msg, details: error.message })
  }
})

// ---- SMART CHAT (Room chat with AI mentions) ----
app.post('/api/ai/smart-reply', async (req, res) => {
  try {
    const { message, chatHistory = [] } = req.body
    if (!message) return res.status(400).json({ error: 'Message is required' })

    const model = getModel()
    const recentChat = chatHistory.slice(-10).map(m => `${m.user}: ${m.content}`).join('\n')

    const prompt = `You are an AI assistant in a study room group chat. A student mentioned you with @AI.
Recent chat context:
${recentChat}

Student's message: ${message}

Reply helpfully and concisely (under 200 words). Be friendly and academic.`

    const response = await withRetry(async () => {
      const result = await model.generateContent(prompt)
      return result.response.text()
    })

    res.json({ response })
  } catch (error) {
    console.error('Smart Reply Error:', error)
    const status = error.message?.includes('429') ? 429 : 500
    const msg = status === 429 ? 'API quota exceeded. Please wait a minute and try again.' : 'Failed to generate smart reply'
    res.status(status).json({ error: msg, details: error.message })
  }
})

// =============================================
// ROOM / MEETING REST ROUTES
// =============================================

// Create a new room/meeting
app.post('/api/meetings/create', (req, res) => {
  const { userName = 'Host' } = req.body
  const meetingId = uuidv4().slice(0, 8)
  getOrCreateRoom(meetingId, userName)
  res.json({ meetingId })
})

// Get room info
app.get('/api/meetings/:id', (req, res) => {
  const room = rooms.get(req.params.id)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  res.json({
    id: room.id,
    createdBy: room.createdBy,
    participantCount: room.participants.size,
    participants: getParticipantsList(room),
  })
})

// Get room state snapshot (for HTTP-based init)
app.get('/api/rooms/:id/state', (req, res) => {
  const room = rooms.get(req.params.id)
  if (!room) return res.status(404).json({ error: 'Room not found' })
  res.json({
    participants: getParticipantsList(room),
    chatMessages: room.chatMessages.slice(-100), // last 100 messages
    tasks: room.tasks,
    sharedNotes: room.sharedNotes,
    resources: room.resources,
    folders: room.folders,
    leaderboard: getLeaderboard(room),
  })
})

// =============================================
// SOCKET.IO REAL-TIME COLLABORATION SERVER
// =============================================
io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`)

  // ─── JOIN ROOM ───────────────────────────────
  socket.on('join-meeting', ({ meetingId, userName }) => {
    const room = getOrCreateRoom(meetingId, userName)

    const participant = {
      id: socket.id,
      name: userName,
      socketId: socket.id,
      joinedAt: new Date().toISOString(),
      audioOn: true,
      videoOn: true,
    }
    room.participants.set(socket.id, participant)

    socket.join(meetingId)
    socket.meetingId = meetingId
    socket.userName = userName

    // Send FULL room state to the new joiner for session initialization
    const existingParticipants = []
    for (const [sid, p] of room.participants) {
      if (sid !== socket.id) existingParticipants.push(p)
    }

    socket.emit('existing-participants', existingParticipants)

    // Send room collaboration state to the joiner
    socket.emit('room-state', {
      chatMessages: room.chatMessages.slice(-100),
      tasks: room.tasks,
      sharedNotes: room.sharedNotes,
      resources: room.resources,
      folders: room.folders,
      leaderboard: getLeaderboard(room),
    })

    // Notify others about the new user
    socket.to(meetingId).emit('user-joined', participant)

    // Broadcast updated participant list to everyone in the room
    io.to(meetingId).emit('participants-updated', getParticipantsList(room))

    // Add a system chat message
    const joinMsg = {
      id: uuidv4(),
      type: 'system',
      content: `${userName} joined the room`,
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    room.chatMessages.push(joinMsg)
    io.to(meetingId).emit('chat-message', joinMsg)

    // Award points for joining
    awardPoints(room, userName, 5, 'Joined study room')
    io.to(meetingId).emit('points-updated', {
      leaderboard: getLeaderboard(room),
      userPoints: room.points.get(userName),
    })

    console.log(`👤 ${userName} joined room ${meetingId} (${room.participants.size} participants)`)
  })

  // ─── WEBRTC SIGNALING ───────────────────────
  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer, userName: socket.userName })
  })

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer })
  })

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate })
  })

  // ─── MEDIA STATE ────────────────────────────
  socket.on('media-state', ({ meetingId, audio, video }) => {
    const room = rooms.get(meetingId)
    if (room) {
      const p = room.participants.get(socket.id)
      if (p) {
        p.audioOn = audio
        p.videoOn = video
      }
    }
    socket.to(meetingId).emit('media-state', { from: socket.id, audio, video })
  })

  // ─── SCREEN SHARING ─────────────────────────
  socket.on('screen-share', ({ meetingId, sharing }) => {
    socket.to(meetingId).emit('screen-share', { from: socket.id, sharing, userName: socket.userName })
  })

  // ─── REAL-TIME CHAT ─────────────────────────
  socket.on('chat-send', ({ meetingId, content }) => {
    const room = rooms.get(meetingId)
    if (!room) return

    const msg = {
      id: uuidv4(),
      type: 'chat',
      user: socket.userName,
      userId: socket.id,
      initials: (socket.userName || 'U').slice(0, 2).toUpperCase(),
      content,
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    room.chatMessages.push(msg)

    // Broadcast to ALL in room (including sender, for confirmation)
    io.to(meetingId).emit('chat-message', msg)

    // Award points for chatting (max once per 30s)
    const lastChatPoint = room.points.get(socket.userName)?.activities
      ?.filter(a => a.label === 'Sent a message')
      ?.pop()
    const now = Date.now()
    if (!lastChatPoint || now - new Date(lastChatPoint.time).getTime() > 30000) {
      awardPoints(room, socket.userName, 1, 'Sent a message')
      io.to(meetingId).emit('points-updated', {
        leaderboard: getLeaderboard(room),
      })
    }

    console.log(`💬 [${meetingId}] ${socket.userName}: ${content.slice(0, 50)}...`)
  })

  // ─── TYPING INDICATOR ──────────────────────
  socket.on('chat-typing', ({ meetingId, isTyping }) => {
    socket.to(meetingId).emit('chat-typing', {
      userId: socket.id,
      userName: socket.userName,
      isTyping,
    })
  })

  // ─── SHARED TASKS ──────────────────────────
  socket.on('task-add', ({ meetingId, task }) => {
    const room = rooms.get(meetingId)
    if (!room) return

    const newTask = {
      id: uuidv4(),
      text: task.text,
      dueDate: task.dueDate || '',
      completed: false,
      createdBy: socket.userName,
      createdAt: new Date().toISOString(),
    }
    room.tasks.push(newTask)
    io.to(meetingId).emit('tasks-updated', room.tasks)

    awardPoints(room, socket.userName, 2, 'Created a task')
    io.to(meetingId).emit('points-updated', { leaderboard: getLeaderboard(room) })

    console.log(`📋 [${meetingId}] ${socket.userName} created task: ${task.text}`)
  })

  socket.on('task-toggle', ({ meetingId, taskId }) => {
    const room = rooms.get(meetingId)
    if (!room) return

    const task = room.tasks.find(t => t.id === taskId)
    if (task) {
      task.completed = !task.completed
      io.to(meetingId).emit('tasks-updated', room.tasks)

      if (task.completed) {
        awardPoints(room, socket.userName, 3, 'Completed a task')
        io.to(meetingId).emit('points-updated', { leaderboard: getLeaderboard(room) })
      }
    }
  })

  socket.on('task-delete', ({ meetingId, taskId }) => {
    const room = rooms.get(meetingId)
    if (!room) return

    room.tasks = room.tasks.filter(t => t.id !== taskId)
    io.to(meetingId).emit('tasks-updated', room.tasks)
  })

  // ─── SHARED NOTES ──────────────────────────
  socket.on('note-create', ({ meetingId, note }) => {
    const room = rooms.get(meetingId)
    if (!room) return

    const newNote = {
      id: uuidv4(),
      title: note.title,
      content: note.content || '',
      createdBy: socket.userName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    room.sharedNotes.unshift(newNote)
    io.to(meetingId).emit('notes-updated', room.sharedNotes)

    awardPoints(room, socket.userName, 2, 'Created a shared note')
    io.to(meetingId).emit('points-updated', { leaderboard: getLeaderboard(room) })

    console.log(`📝 [${meetingId}] ${socket.userName} created note: ${note.title}`)
  })

  socket.on('note-update', ({ meetingId, noteId, title, content }) => {
    const room = rooms.get(meetingId)
    if (!room) return

    const note = room.sharedNotes.find(n => n.id === noteId)
    if (note) {
      note.title = title ?? note.title
      note.content = content ?? note.content
      note.updatedAt = new Date().toISOString()
      io.to(meetingId).emit('notes-updated', room.sharedNotes)
    }
  })

  socket.on('note-delete', ({ meetingId, noteId }) => {
    const room = rooms.get(meetingId)
    if (!room) return

    room.sharedNotes = room.sharedNotes.filter(n => n.id !== noteId)
    io.to(meetingId).emit('notes-updated', room.sharedNotes)
  })

  // ─── SHARED RESOURCES ─────────────────────
  socket.on('resource-folder-create', ({ meetingId, name }) => {
    const room = rooms.get(meetingId)
    if (!room) return

    const folder = { id: 'f-' + uuidv4().slice(0, 8), name, createdBy: socket.userName }
    room.folders.push(folder)
    io.to(meetingId).emit('resources-updated', { resources: room.resources, folders: room.folders })
  })

  socket.on('resource-add', ({ meetingId, resource }) => {
    const room = rooms.get(meetingId)
    if (!room) return

    const newResource = {
      id: 'res-' + uuidv4().slice(0, 8),
      name: resource.name,
      type: resource.type || 'default',
      size: resource.size || '0 KB',
      folderId: resource.folderId || null,
      uploadedBy: socket.userName,
      uploadedAt: new Date().toISOString(),
    }
    room.resources.push(newResource)
    io.to(meetingId).emit('resources-updated', { resources: room.resources, folders: room.folders })

    awardPoints(room, socket.userName, 3, 'Shared a resource')
    io.to(meetingId).emit('points-updated', { leaderboard: getLeaderboard(room) })

    console.log(`📁 [${meetingId}] ${socket.userName} shared: ${resource.name}`)
  })

  socket.on('resource-delete', ({ meetingId, resourceId }) => {
    const room = rooms.get(meetingId)
    if (!room) return

    room.resources = room.resources.filter(r => r.id !== resourceId)
    io.to(meetingId).emit('resources-updated', { resources: room.resources, folders: room.folders })
  })

  // ─── POINTS REQUEST ────────────────────────
  socket.on('get-points', ({ meetingId }) => {
    const room = rooms.get(meetingId)
    if (!room) return

    const userPointsData = room.points.get(socket.userName) || { points: 0, activities: [] }
    socket.emit('points-updated', {
      leaderboard: getLeaderboard(room),
      userPoints: userPointsData,
    })
  })

  // ─── DISCONNECT ────────────────────────────
  socket.on('disconnect', () => {
    const { meetingId, userName } = socket
    if (meetingId && rooms.has(meetingId)) {
      const room = rooms.get(meetingId)
      room.participants.delete(socket.id)

      socket.to(meetingId).emit('user-left', { id: socket.id })

      // Broadcast updated participant list
      io.to(meetingId).emit('participants-updated', getParticipantsList(room))

      // System message about leaving
      const leaveMsg = {
        id: uuidv4(),
        type: 'system',
        content: `${userName || 'A user'} left the room`,
        timestamp: Date.now(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      room.chatMessages.push(leaveMsg)
      io.to(meetingId).emit('chat-message', leaveMsg)

      console.log(`👤 ${userName} left room ${meetingId} (${room.participants.size} remaining)`)

      // Clean up empty rooms after 10 minutes
      if (room.participants.size === 0) {
        setTimeout(() => {
          if (rooms.has(meetingId) && rooms.get(meetingId).participants.size === 0) {
            rooms.delete(meetingId)
            console.log(`🗑️ Cleaned up empty room ${meetingId}`)
          }
        }, 10 * 60 * 1000)
      }
    }
    console.log(`🔌 Socket disconnected: ${socket.id}`)
  })
})

// Start server
httpServer.listen(PORT, () => {
  console.log(`\n🚀 StudyHub Backend running on http://localhost:${PORT}`)
  console.log(`📹 WebRTC Signaling Server active`)
  console.log(`� Real-Time Chat active`)
  console.log(`📋 Real-Time Tasks active`)
  console.log(`📝 Real-Time Notes active`)
  console.log(`📁 Real-Time Resources active`)
  console.log(`🏆 Points & Leaderboard active`)
  console.log(`\n📚 REST API Endpoints:`)
  console.log(`   POST /api/ai/chat           - AI Study Assistant`)
  console.log(`   POST /api/ai/summarize-pdf   - PDF Summarizer`)
  console.log(`   POST /api/ai/generate-quiz   - Quiz Generator`)
  console.log(`   POST /api/ai/voice           - Voice Assistant`)
  console.log(`   POST /api/ai/enhance-notes   - Notes AI Enhance`)
  console.log(`   POST /api/ai/smart-reply     - Smart Chat Reply`)
  console.log(`   POST /api/meetings/create    - Create Room`)
  console.log(`   GET  /api/meetings/:id       - Get Room Info`)
  console.log(`   GET  /api/rooms/:id/state    - Get Room State`)
  console.log(`   GET  /api/health             - Health Check`)
  console.log(`\n🔌 Socket.IO Events:`)
  console.log(`   join-meeting     - Join a room & receive full state`)
  console.log(`   chat-send        - Send a chat message`)
  console.log(`   chat-typing      - Typing indicator`)
  console.log(`   task-add/toggle/delete  - Manage shared tasks`)
  console.log(`   note-create/update/delete - Manage shared notes`)
  console.log(`   resource-add/delete - Manage shared resources`)
  console.log(`   resource-folder-create - Create resource folders`)
  console.log(`   offer/answer/ice-candidate - WebRTC signaling`)
  console.log(`   media-state      - Audio/video toggle`)
  console.log(`   screen-share     - Screen sharing`)
  console.log(`   get-points       - Request points data\n`)
})
