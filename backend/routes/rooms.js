import express from 'express'
import Room from '../models/Room.js'
import RoomSessionArchive from '../models/RoomSessionArchive.js'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import StudySession from '../models/StudySession.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
const ROOM_SESSION_RETENTION_DAYS = Math.max(1, Number(process.env.ROOM_SESSION_RETENTION_DAYS || 7))

function isRoomParticipant(room, userId) {
  if (!room) return false
  if (String(room.createdBy) === String(userId)) return true
  return (room.participants || []).some(participantId => String(participantId) === String(userId))
}

function normalizeDate(value, fallback = new Date()) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date : fallback
}

function buildArchiveSummary(payload) {
  return {
    chatCount: payload.chatMessages?.length || 0,
    taskCount: payload.tasks?.length || 0,
    noteCount: payload.sharedNotes?.length || 0,
    resourceCount: payload.resources?.length || 0,
    folderCount: payload.folders?.length || 0,
    quizSubmissionCount: payload.quizResults?.length || 0,
    retentionDays: ROOM_SESSION_RETENTION_DAYS,
  }
}

async function createFallbackArchiveFromRoom(room) {
  const endedAt = normalizeDate(room.endedAt, new Date())
  const startedAt = normalizeDate(room.createdAt, new Date(endedAt.getTime() - 30 * 60 * 1000))
  const duration = room.duration || Math.max(0, Math.round((endedAt - startedAt) / 60000))
  const expiresAt = new Date(endedAt.getTime() + ROOM_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const participantUsers = room.participants?.length > 0
    ? await User.find({ _id: { $in: room.participants } }).select('name').lean()
    : []

  const participantNames = Array.from(new Set([
    room.createdBy?.name,
    ...participantUsers.map(user => user.name).filter(Boolean),
  ].filter(Boolean)))

  const participants = participantNames.map(name => ({
    name,
    isHost: name === room.createdBy?.name,
    joinedAt: null,
    points: 0,
    rank: null,
  }))

  const payload = {
    roomId: String(room._id),
    roomName: room.name || `Study Room ${room._id}`,
    subject: room.subject || 'General Study',
    createdByName: room.createdBy?.name || 'Host',
    createdById: room.createdBy?._id || room.createdBy || null,
    startedAt,
    endedAt,
    duration,
    maxParticipants: Math.max(room.maxParticipants || 0, participantNames.length),
    participantNames,
    participants,
    chatMessages: [],
    tasks: [],
    sharedNotes: [],
    resources: [],
    folders: [],
    activeQuiz: null,
    quizResults: [],
    leaderboard: [],
    expiresAt,
  }

  return RoomSessionArchive.findOneAndUpdate(
    { roomId: String(room._id) },
    {
      ...payload,
      summary: buildArchiveSummary(payload),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
}

// Create a new room
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const { name, subject, privacy, audio, video, scheduledFor, invitedMembers } = req.body
    const userId = req.user._id
    
    const roomData = {
      name,
      subject,
      privacy,
      audio,
      video,
      createdBy: userId,
      participants: [userId],
    }
    
    // If scheduledFor is provided, set status to scheduled
    if (scheduledFor) {
      roomData.scheduledFor = new Date(scheduledFor)
      roomData.status = 'scheduled'
    } else {
      roomData.status = 'active'
    }
    
    const room = await Room.create(roomData)
    await User.findByIdAndUpdate(userId, { 
      $push: { createdRooms: room._id, joinedRooms: room._id } 
    })

    // Handle invited members — look up by email and create notifications
    if (invitedMembers && invitedMembers.length > 0) {
      const invitedUsers = await User.find({ email: { $in: invitedMembers } })
      for (const invitedUser of invitedUsers) {
        // Don't notify self
        if (String(invitedUser._id) === String(userId)) continue
        await Notification.create({
          userId: invitedUser._id,
          type: 'room_invite',
          title: 'Room Invitation',
          message: `${req.user.name} invited you to join "${room.name}"`,
          roomId: room._id,
        })
      }
    }
    
    res.json({ ok: true, room })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create room', details: err.message })
  }
})

// Join a room
router.post('/:id/join', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id
    const room = await Room.findById(req.params.id)
    if (!room) return res.status(404).json({ error: 'Room not found' })
    if (room.ended) return res.status(400).json({ error: 'Room has ended' })
    
    if (!isRoomParticipant(room, userId)) {
      room.participants.push(userId)
      // Update max participants count
      if (room.participants.length > room.maxParticipants) {
        room.maxParticipants = room.participants.length
      }
      await room.save()
      await User.findByIdAndUpdate(userId, { $addToSet: { joinedRooms: room._id } })
    }
    
    res.json({ ok: true, room })
  } catch (err) {
    res.status(500).json({ error: 'Failed to join room', details: err.message })
  }
})

// End a room (host only)
router.post('/:id/end', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id
    const room = await Room.findById(req.params.id)
    if (!room) return res.status(404).json({ error: 'Room not found' })
    if (room.ended) return res.json({ ok: true, room }) // Already ended
    if (String(room.createdBy) !== String(userId)) {
      // Non-host: just remove them from participants
      room.participants = room.participants.filter(p => String(p) !== String(userId))
      // If no participants remain, auto-end the room
      if (room.participants.length === 0) {
        room.ended = true
        room.endedAt = new Date()
        room.status = 'completed'
        room.duration = Math.round((room.endedAt - room.createdAt) / 60000)
      }
      await room.save()
      return res.json({ ok: true, room })
    }
    
    room.ended = true
    room.endedAt = new Date()
    room.status = 'completed'
    room.duration = Math.round((room.endedAt - room.createdAt) / 60000)
    await room.save()
    
    res.json({ ok: true, room })
  } catch (err) {
    res.status(500).json({ error: 'Failed to end room', details: err.message })
  }
})

// Get all active rooms (user-specific: only rooms user has joined/created)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id
    const rooms = await Room.find({ 
      ended: false,
      status: 'active',
      participants: userId
    }).populate('createdBy', 'name email')
    res.json({ rooms })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rooms', details: err.message })
  }
})

// Get room info
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const room = await Room.findById(req.params.id).populate('createdBy', 'name email')
    if (!room) return res.status(404).json({ error: 'Room not found' })
    res.json({ room })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch room', details: err.message })
  }
})

router.get('/:id/session-archive', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id
    const room = await Room.findById(req.params.id).populate('createdBy', 'name email')
    if (!room) return res.status(404).json({ error: 'Room not found' })
    if (!isRoomParticipant(room, userId)) {
      return res.status(403).json({ error: 'You do not have access to this session archive' })
    }

    let archive = await RoomSessionArchive.findOne({ roomId: req.params.id }).lean()
    if (!archive && room.ended) {
      const created = await createFallbackArchiveFromRoom(room)
      archive = created?.toObject ? created.toObject() : created
    }

    if (!archive) {
      return res.status(404).json({ error: 'Session archive not found yet. Please try again in a few seconds.' })
    }

    res.json({ archive })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session archive', details: err.message })
  }
})

router.post('/:id/session-archive', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id
    const room = await Room.findById(req.params.id).populate('createdBy', 'name email')
    if (!room) return res.status(404).json({ error: 'Room not found' })
    if (!isRoomParticipant(room, userId)) {
      return res.status(403).json({ error: 'You do not have access to this session archive' })
    }

    const body = req.body || {}
    const endedAt = normalizeDate(body.endedAt, normalizeDate(room.endedAt, new Date()))
    const startedAt = normalizeDate(body.startedAt, normalizeDate(room.createdAt, new Date(endedAt.getTime() - 30 * 60 * 1000)))
    const duration = Number.isFinite(Number(body.duration))
      ? Number(body.duration)
      : (room.duration || Math.max(0, Math.round((endedAt - startedAt) / 60000)))
    const expiresAt = new Date(endedAt.getTime() + ROOM_SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000)

    const participantNames = Array.from(new Set([
      room.createdBy?.name,
      ...(body.participantNames || []),
      ...((body.participants || []).map(participant => participant?.name).filter(Boolean)),
    ].filter(Boolean)))

    const payload = {
      roomId: String(room._id),
      roomName: body.roomName || room.name || `Study Room ${room._id}`,
      subject: body.subject || room.subject || 'General Study',
      createdByName: body.createdByName || room.createdBy?.name || 'Host',
      createdById: room.createdBy?._id || room.createdBy || null,
      startedAt,
      endedAt,
      duration,
      maxParticipants: Math.max(
        Number(body.maxParticipants) || 0,
        room.maxParticipants || 0,
        participantNames.length,
        (body.participants || []).length
      ),
      participantNames,
      participants: Array.isArray(body.participants) ? body.participants : [],
      chatMessages: Array.isArray(body.chatMessages) ? body.chatMessages.slice(-500) : [],
      tasks: Array.isArray(body.tasks) ? body.tasks : [],
      sharedNotes: Array.isArray(body.sharedNotes) ? body.sharedNotes : [],
      resources: Array.isArray(body.resources) ? body.resources : [],
      folders: Array.isArray(body.folders) ? body.folders : [],
      activeQuiz: body.activeQuiz || null,
      quizResults: Array.isArray(body.quizResults) ? body.quizResults : [],
      leaderboard: Array.isArray(body.leaderboard) ? body.leaderboard : [],
      expiresAt,
    }

    const archive = await RoomSessionArchive.findOneAndUpdate(
      { roomId: String(room._id) },
      {
        ...payload,
        summary: buildArchiveSummary(payload),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.json({ ok: true, archive })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save session archive', details: err.message })
  }
})

// Get user's room history (created and joined)
router.get('/user/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id
    
    // Get all rooms user created or joined
    const createdRooms = await Room.find({ createdBy: userId })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      
    const joinedRooms = await Room.find({ 
      participants: userId,
      createdBy: { $ne: userId }
    })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
    
    res.json({
      createdRooms,
      joinedRooms,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user room history', details: err.message })
  }
})

// Get user's session statistics
router.get('/user/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id
    
    // Active sessions
    const activeSessions = await Room.find({
      participants: userId,
      ended: false,
      status: 'active'
    }).populate('createdBy', 'name email')
    
    // Recent completed sessions (last 10)
    const recentSessions = await Room.find({
      participants: userId,
      status: 'completed'
    })
      .populate('createdBy', 'name email')
      .sort({ endedAt: -1 })
      .limit(10)

    const recentSessionIds = recentSessions.map(room => String(room._id))
    const recentArchives = recentSessionIds.length > 0
      ? await RoomSessionArchive.find({ roomId: { $in: recentSessionIds } })
        .select('roomId expiresAt')
        .lean()
      : []
    const archiveByRoomId = new Map(recentArchives.map(archive => [String(archive.roomId), archive.expiresAt]))
    
    // Upcoming scheduled rooms
    const upcomingRooms = await Room.find({
      participants: userId,
      status: 'scheduled',
      scheduledFor: { $gte: new Date() }
    })
      .populate('createdBy', 'name email')
      .sort({ scheduledFor: 1 })
    
    // Also fetch upcoming study sessions from the Schedule page
    const today = new Date().toISOString().split('T')[0]
    const upcomingStudySessions = await StudySession.find({
      userId,
      status: 'upcoming',
      date: { $gte: today },
    }).sort({ date: 1 }).limit(10)

    // Merge both into a single upcoming list
    const upcomingSessions = [
      ...upcomingRooms.map(r => ({
        _id: r._id,
        name: r.name,
        subject: r.subject,
        scheduledFor: r.scheduledFor,
        participants: r.participants,
        createdBy: r.createdBy,
        source: 'room',
      })),
      ...upcomingStudySessions.map(s => ({
        _id: s._id,
        name: s.title,
        subject: s.subject,
        scheduledFor: s.date + (s.time ? `T${s.time}` : 'T00:00'),
        participants: [],
        createdBy: { name: 'You' },
        source: 'schedule',
        duration: s.duration,
        type: s.type,
      })),
    ].sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
    
    // Calculate total study time
    const completedRooms = await Room.find({
      participants: userId,
      status: 'completed'
    })
    
    const totalMinutes = completedRooms.reduce((sum, room) => sum + (room.duration || 0), 0)
    const totalHours = Math.round(totalMinutes / 60 * 10) / 10
    
    // Subject distribution from ALL rooms user participated in (not just completed)
    const allUserRooms = await Room.find({
      $or: [
        { participants: userId },
        { createdBy: userId }
      ]
    })
    
    const subjectMap = {}
    allUserRooms.forEach(room => {
      if (room.subject) {
        // Use duration for completed rooms, otherwise count as 1 session
        subjectMap[room.subject] = (subjectMap[room.subject] || 0) + (room.duration || 1)
      }
    })
    
    res.json({
      activeSessions,
      recentSessions: recentSessions.map(room => {
        const archiveExpiresAt = archiveByRoomId.get(String(room._id)) || null
        return {
          ...room.toObject(),
          hasArchive: Boolean(archiveExpiresAt),
          archiveExpiresAt,
        }
      }),
      upcomingSessions,
      totalHours,
      totalSessions: completedRooms.length,
      subjectDistribution: subjectMap
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user stats', details: err.message })
  }
})

export default router
