import express from 'express'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Resource from '../models/Resource.js'
import Room from '../models/Room.js'
import RoomSessionArchive from '../models/RoomSessionArchive.js'
import StudySession from '../models/StudySession.js'
import StudyActivity from '../models/StudyActivity.js'
import QuizSession from '../models/QuizSession.js'
import AiUsageLog from '../models/AiUsageLog.js'
import Notification from '../models/Notification.js'
import ModerationCase from '../models/ModerationCase.js'
import AppSettings, { DEFAULT_GAMIFICATION } from '../models/AppSettings.js'
import BadgeProgress from '../models/BadgeProgress.js'
import ActivityReport from '../models/ActivityReport.js'
import { adminAuthMiddleware } from '../middleware/adminAuth.js'
import { buildUserReportPayload, createUserReport } from '../services/reportService.js'
import { calculateStudyHoursForUsers, formatStudyHours } from '../lib/studyTimeUtils.js'

const router = express.Router()

// All routes here require admin authentication
router.use(adminAuthMiddleware)

// ════════════════════════════════════════════════
// DASHBOARD ANALYTICS
// ════════════════════════════════════════════════

router.get('/dashboard', async (req, res) => {
  try {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // --- Totals ---
    const totalUsers = await User.countDocuments()
    const totalResources = await Resource.countDocuments()
    const totalRooms = await Room.countDocuments()
    const activeRooms = await Room.countDocuments({ status: 'active', ended: false })
    const totalQuizzes = await QuizSession.countDocuments()

    const todayStr = now.toISOString().split('T')[0]
    const weekStudyStart = sevenDaysAgo.toISOString().split('T')[0]
    const monthStudyStart = thirtyDaysAgo.toISOString().split('T')[0]

    const [dauCount, wauCount, mauCount] = await Promise.all([
      StudyActivity.distinct('userId', { date: todayStr }).then(a => a.length),
      StudyActivity.distinct('userId', { date: { $gte: weekStudyStart } }).then(a => a.length),
      StudyActivity.distinct('userId', { date: { $gte: monthStudyStart } }).then(a => a.length),
    ])

    const totalStudyHoursAgg = await StudyActivity.aggregate([
      { $group: { _id: null, t: { $sum: '$hours' } } },
    ])
    const studyActivityHours = Math.round((totalStudyHoursAgg[0]?.t || 0) * 10) / 10
    
    // Also aggregate from User.totalStudyHours as fallback
    const userStudyHoursAgg = await User.aggregate([
      { $group: { _id: null, t: { $sum: '$totalStudyHours' } } },
    ])
    const userProfileHours = Math.round((userStudyHoursAgg[0]?.t || 0) * 10) / 10
    
    // Also calculate from completed rooms
    const completedRooms = await Room.find({ status: 'completed' })
      .select('duration createdAt endedAt participants createdBy')
      .lean()
    
    let roomHoursTotal = 0
    for (const room of completedRooms) {
      const storedMinutes = Math.max(0, Number(room.duration) || 0)
      const derivedMinutes = room.endedAt && room.createdAt
        ? Math.max(0, Math.round((new Date(room.endedAt) - new Date(room.createdAt)) / 60000))
        : 0
      const minutes = Math.max(storedMinutes, derivedMinutes)
      if (minutes > 0) {
        // Count unique participants
        const participants = new Set()
        if (room.createdBy) participants.add(room.createdBy.toString())
        if (Array.isArray(room.participants)) {
          room.participants.forEach(p => { if (p) participants.add(p.toString()) })
        }
        // Each participant gets the full room duration
        roomHoursTotal += (minutes / 60) * participants.size
      }
    }
    roomHoursTotal = Math.round(roomHoursTotal * 10) / 10
    
    // Use the maximum of all three sources
    const totalStudyHours = Math.max(studyActivityHours, userProfileHours, roomHoursTotal)
    const aiRequests = await AiUsageLog.countDocuments()

    const studyHoursByDay = await StudyActivity.aggregate([
      { $match: { date: { $gte: monthStudyStart } } },
      { $group: { _id: '$date', totalHours: { $sum: '$hours' } } },
      { $sort: { _id: 1 } },
    ])

    const aiUsageByDay = await AiUsageLog.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // --- New users in last 30 days ---
    const newUsersLast30 = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } })

    // --- User signups per day (last 30 days) ---
    const userSignups = await User.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // --- Room creation per day (last 30 days) ---
    const roomCreations = await Room.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // --- Resources uploaded per day (last 30 days) ---
    const resourceUploads = await Resource.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ])

    // --- Resource category breakdown ---
    const resourcesByCategory = await Resource.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ])

    // --- Room status breakdown ---
    const roomsByStatus = await Room.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ])

    // --- Top users by XP ---
    const topUsers = await User.find()
      .sort({ totalXP: -1 })
      .limit(10)
      .select('name email avatar totalXP totalStudyHours currentStreak')
      .lean()

    // --- Study activity (last 7 days aggregated across all users) ---
    const startStr = sevenDaysAgo.toISOString().split('T')[0]
    const studyActivityAgg = await StudyActivity.aggregate([
      { $match: { date: { $gte: startStr } } },
      { $group: { _id: '$date', totalHours: { $sum: '$hours' }, userCount: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ])

    // --- Recent activity (latest 10 signups) ---
    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select('name email avatar createdAt role institution')
      .lean()

    res.json({
      ok: true,
      stats: {
        totalUsers,
        totalResources,
        totalRooms,
        activeRooms,
        totalQuizzes,
        newUsersLast30,
        dau: dauCount,
        wau: wauCount,
        mau: mauCount,
        totalStudyHours,
        aiRequests,
      },
      charts: {
        userSignups: fillDays(userSignups, 30),
        roomCreations: fillDays(roomCreations, 30),
        resourceUploads: fillDays(resourceUploads, 30),
        studyHoursTrend: fillDayHours(studyHoursByDay, 30),
        aiUsageTrend: fillDays(aiUsageByDay, 30),
        resourcesByCategory,
        roomsByStatus,
        studyActivity: studyActivityAgg,
      },
      topUsers,
      recentUsers,
    })
  } catch (err) {
    console.error('Admin dashboard error:', err)
    res.status(500).json({ error: 'Failed to fetch admin dashboard data' })
  }
})

// Helper: fill missing days in aggregation results
function fillDays(data, numDays) {
  const map = {}
  data.forEach(d => { map[d._id] = d.count })
  const result = []
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    result.push({ date: key, count: map[key] || 0 })
  }
  return result
}

function fillDayHours(data, numDays) {
  const map = {}
  data.forEach(d => { map[d._id] = d.totalHours })
  const result = []
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    result.push({ date: key, hours: Math.round((map[key] || 0) * 100) / 100 })
  }
  return result
}

function parseDurationToHours(value) {
  if (value == null) return 0
  if (typeof value === 'number' && Number.isFinite(value)) {
    // In this codebase, numeric study-session duration is usually minutes.
    return value / 60
  }
  const text = String(value).trim().toLowerCase()
  if (!text) return 0

  const hourMinMatch = text.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(\d+(?:\.\d+)?)?\s*m?(?:in(?:ute)?s?)?$/)
  if (hourMinMatch) {
    const h = Number(hourMinMatch[1]) || 0
    const m = Number(hourMinMatch[2]) || 0
    return h + (m / 60)
  }

  const hoursMatch = text.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/)
  if (hoursMatch) return Number(hoursMatch[1]) || 0

  const minsMatch = text.match(/^(\d+(?:\.\d+)?)\s*m(?:in(?:ute)?s?)?$/)
  if (minsMatch) return (Number(minsMatch[1]) || 0) / 60

  const numeric = Number(text)
  if (Number.isFinite(numeric)) return numeric / 60

  return 0
}

// ════════════════════════════════════════════════
// USER MANAGEMENT
// ════════════════════════════════════════════════

// List all users with pagination + search
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const search = req.query.search || ''
    const role = req.query.role || ''
    const sort = req.query.sort || '-createdAt'

    const filter = {}
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]
    }
    if (role === 'admin' || role === 'user') {
      filter.role = role
    }

    const total = await User.countDocuments(filter)
    const users = await User.find(filter)
      .select('-password -resetPasswordToken -emailVerificationOtp')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    // Calculate study hours consistently for all users
    const studyHoursMap = await calculateStudyHoursForUsers(users)

    const usersWithStudy = users.map((u) => {
      const studyHours = studyHoursMap.get(u._id.toString()) || 0
      return { ...u, studyHours }
    })

    res.json({ ok: true, users: usersWithStudy, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('Admin list users error:', err)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

// Update a user (change role, etc.)
router.put('/users/:id', async (req, res) => {
  try {
    const { role, name, bio, institution, major } = req.body
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Cannot demote yourself
    if (req.user._id.toString() === req.params.id && role === 'user' && user.role === 'admin') {
      return res.status(400).json({ error: 'Cannot demote yourself' })
    }

    if (role && ['user', 'admin'].includes(role)) user.role = role
    if (name) user.name = name.trim()
    if (bio !== undefined) user.bio = bio
    if (institution !== undefined) user.institution = institution
    if (major !== undefined) user.major = major

    await user.save()
    res.json({ ok: true, user: user.toSafeObject() })
  } catch (err) {
    console.error('Admin update user error:', err)
    res.status(500).json({ error: 'Failed to update user' })
  }
})

// Delete a user
router.delete('/users/:id', async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' })
    }
    const user = await User.findByIdAndDelete(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ ok: true, message: 'User deleted' })
  } catch (err) {
    console.error('Admin delete user error:', err)
    res.status(500).json({ error: 'Failed to delete user' })
  }
})

// ════════════════════════════════════════════════
// RESOURCE MANAGEMENT
// ════════════════════════════════════════════════

router.get('/resources', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const search = req.query.search || ''
    const subject = req.query.subject || ''
    const userId = req.query.userId || ''

    const filter = {}
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { contributorName: { $regex: search, $options: 'i' } },
      ]
    }
    if (subject) filter.subject = { $regex: subject, $options: 'i' }
    if (userId && mongoose.Types.ObjectId.isValid(userId)) filter.userId = userId

    const total = await Resource.countDocuments(filter)
    const resources = await Resource.find(filter)
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    res.json({ ok: true, resources, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('Admin list resources error:', err)
    res.status(500).json({ error: 'Failed to fetch resources' })
  }
})

router.delete('/resources/:id', async (req, res) => {
  try {
    const resource = await Resource.findByIdAndDelete(req.params.id)
    if (!resource) return res.status(404).json({ error: 'Resource not found' })
    res.json({ ok: true, message: 'Resource deleted' })
  } catch (err) {
    console.error('Admin delete resource error:', err)
    res.status(500).json({ error: 'Failed to delete resource' })
  }
})

// Toggle featured status
router.put('/resources/:id/featured', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id)
    if (!resource) return res.status(404).json({ error: 'Resource not found' })
    resource.featured = !resource.featured
    await resource.save()
    res.json({ ok: true, featured: resource.featured })
  } catch (err) {
    console.error('Admin toggle featured error:', err)
    res.status(500).json({ error: 'Failed to toggle featured' })
  }
})

// ════════════════════════════════════════════════
// ROOM MANAGEMENT
// ════════════════════════════════════════════════

router.get('/rooms', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const status = req.query.status || ''

    const filter = {}
    if (status) filter.status = status

    const total = await Room.countDocuments(filter)
    const rooms = await Room.find(filter)
      .populate('createdBy', 'name email avatar')
      .populate('participants', 'name email avatar')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    res.json({ ok: true, rooms, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('Admin list rooms error:', err)
    res.status(500).json({ error: 'Failed to fetch rooms' })
  }
})

router.delete('/rooms/:id', async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id)
    if (!room) return res.status(404).json({ error: 'Room not found' })
    // Also delete session archive
    await RoomSessionArchive.deleteMany({ roomId: req.params.id })
    res.json({ ok: true, message: 'Room deleted' })
  } catch (err) {
    console.error('Admin delete room error:', err)
    res.status(500).json({ error: 'Failed to delete room' })
  }
})

// Force end a room
router.put('/rooms/:id/end', async (req, res) => {
  try {
    const room = await Room.findById(req.params.id)
    if (!room) return res.status(404).json({ error: 'Room not found' })
    room.ended = true
    room.status = 'completed'
    room.endedAt = new Date()
    room.duration = Math.round((room.endedAt - room.createdAt) / 60000)
    await room.save()
    
    // Track study hours for all participants
    const { trackRoomCompletion } = await import('../services/badgeTrackingService.js')
    trackRoomCompletion(room._id, room.participants, room.duration, room.subject).catch(err =>
      console.error('Room completion tracking error:', err)
    )
    
    res.json({ ok: true, message: 'Room ended' })
  } catch (err) {
    console.error('Admin end room error:', err)
    res.status(500).json({ error: 'Failed to end room' })
  }
})

// ════════════════════════════════════════════════
// MAKE USER ADMIN (special endpoint)
// ════════════════════════════════════════════════

router.post('/promote', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required' })
    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user) return res.status(404).json({ error: 'User not found' })
    user.role = 'admin'
    await user.save()
    res.json({ ok: true, user: user.toSafeObject() })
  } catch (err) {
    console.error('Admin promote error:', err)
    res.status(500).json({ error: 'Failed to promote user' })
  }
})

router.get('/users/:id/detail', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' })
    }
    const payload = await buildUserReportPayload(req.params.id, 30)
    if (!payload) return res.status(404).json({ error: 'User not found' })
    const user = await User.findById(req.params.id).select('-password').lean()
    const reportsCount = await ActivityReport.countDocuments({ userId: req.params.id })
    res.json({
      ok: true,
      user,
      activity: payload,
      reportsCount,
    })
  } catch (err) {
    console.error('Admin user detail error:', err)
    res.status(500).json({ error: 'Failed to load user detail' })
  }
})

router.post('/users/:id/reports', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid user id' })
    }

    const rangeDays = Math.min(90, Math.max(7, parseInt(req.body?.rangeDays, 10) || 30))
    const format = req.body?.format === 'json' ? 'json' : 'pdf'
    const { report, error } = await createUserReport(req.params.id, { rangeDays, format })
    if (error) {
      return res.status(500).json({ error: error || 'Failed to generate report' })
    }

    res.status(201).json({
      ok: true,
      report: {
        id: report._id,
        format: report.format,
        status: report.status,
        reportUrl: report.reportUrl,
        generatedAt: report.createdAt,
        aiInsights: report.aiInsights,
      },
    })
  } catch (err) {
    console.error('Admin generate user report error:', err)
    res.status(500).json({ error: 'Failed to generate report for user' })
  }
})

router.post('/users/:id/ban', async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: 'Cannot ban yourself' })
    }
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    user.banned = true
    user.bannedAt = new Date()
    user.bannedReason = (req.body.reason || 'Policy violation').slice(0, 500)
    await user.save()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to ban user' })
  }
})

router.post('/users/:id/unban', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    user.banned = false
    user.bannedAt = null
    user.bannedReason = ''
    await user.save()
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to unban user' })
  }
})

router.post('/users/:id/warn', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    user.moderationWarnings = (user.moderationWarnings || 0) + 1
    await user.save()
    await Notification.create({
      userId: user._id,
      type: 'moderation',
      title: 'Moderation warning',
      message: (req.body.message || 'A moderator issued a warning regarding your account activity.').slice(0, 1000),
      read: false,
    })
    res.json({ ok: true, warnings: user.moderationWarnings })
  } catch (err) {
    res.status(500).json({ error: 'Failed to warn user' })
  }
})

router.post('/users/:id/reset-stats', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    user.totalStudyHours = 0
    user.totalXP = 0
    user.currentStreak = 0
    user.longestStreak = 0
    user.lastStudyDate = null
    await user.save()
    await StudyActivity.deleteMany({ userId: user._id })
    await BadgeProgress.deleteMany({ userId: user._id })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset stats' })
  }
})

router.put('/users/:id/ai-quota', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const { dailyTokenLimit, monthlyRequestLimit, disabledFeatures } = req.body
    user.aiQuota = user.aiQuota || {}
    if (dailyTokenLimit !== undefined) user.aiQuota.dailyTokenLimit = dailyTokenLimit === null ? null : Number(dailyTokenLimit)
    if (monthlyRequestLimit !== undefined) user.aiQuota.monthlyRequestLimit = monthlyRequestLimit === null ? null : Number(monthlyRequestLimit)
    if (Array.isArray(disabledFeatures)) user.aiQuota.disabledFeatures = disabledFeatures.map(String)
    await user.save()
    res.json({ ok: true, aiQuota: user.aiQuota })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update AI quota' })
  }
})

router.get('/analytics/advanced', async (req, res) => {
  try {
    const now = new Date()
    const d30 = new Date(now.getTime() - 30 * 86400000)
    const d60 = new Date(now.getTime() -60 * 86400000)
    const studyStart = d30.toISOString().split('T')[0]
    const prevStudyStart = d60.toISOString().split('T')[0]
    const prevStudyEnd = d30.toISOString().split('T')[0]

    const activeRecent = await StudyActivity.distinct('userId', { date: { $gte: studyStart } })
    const activePrev = await StudyActivity.distinct('userId', {
      date: { $gte: prevStudyStart, $lt: prevStudyEnd },
    })
    const prevSet = new Set(activePrev.map(id => id.toString()))
    const churned = activePrev.filter(id => !activeRecent.some(r => r.toString() === id.toString())).length
    const churnRate = activePrev.length ? Math.round((churned / activePrev.length) * 1000) / 10 : 0

    const weekAgoMs = now.getTime() - 7 * 86400000
    const matureUsers = await User.find({ createdAt: { $lte: new Date(weekAgoMs) } }).select('_id').lean()
    const matureSet = new Set(matureUsers.map(u => u._id.toString()))
    const recentlyActiveIds = await StudyActivity.distinct('userId', { date: { $gte: studyStart } })
    const engagedMature = recentlyActiveIds.filter(id => matureSet.has(id.toString())).length
    const retentionRollingApprox = matureUsers.length
      ? Math.round((engagedMature / matureUsers.length) * 1000) / 10
      : null

    const userCount = await User.countDocuments()
    const hoursSum = await StudyActivity.aggregate([{ $group: { _id: null, t: { $sum: '$hours' } } }])
    const totalH = hoursSum[0]?.t || 0
    const avgStudyHoursPerUser = userCount ? Math.round((totalH / userCount) * 100) / 100 : 0

    const topSubjects = await StudySession.aggregate([
      { $match: { status: 'completed', subject: { $nin: ['', null] } } },
      {
        $group: {
          _id: '$subject',
          minutes: {
            $sum: {
              $convert: { input: '$duration', to: 'double', onError: 1, onNull: 1 },
            },
          },
        },
      },
      { $sort: { minutes: -1 } },
      { $limit: 12 },
    ])

    res.json({
      ok: true,
      retention: {
        matureUsersWithActivityLast30dPercent: retentionRollingApprox,
        note: 'Accounts older than 7 days with ≥1 study day in the last 30 days (StudyActivity).',
      },
      churn: { ratePercentLast30vsPrior30: churnRate, priorActiveUsers: activePrev.length },
      avgStudyHoursPerUser,
      mostStudiedSubjects: topSubjects.map(s => ({ subject: s._id, minutes: Math.round(s.minutes) })),
    })
  } catch (err) {
    console.error('Admin analytics error:', err)
    res.status(500).json({ error: 'Failed to load analytics' })
  }
})

router.get('/ai-usage/summary', async (req, res) => {
  try {
    const byFeature = await AiUsageLog.aggregate([
      { $group: { _id: '$feature', requests: { $sum: 1 }, tokens: { $sum: '$tokensEstimate' } } },
      { $sort: { requests: -1 } },
    ])
    const byUser = await AiUsageLog.aggregate([
      { $group: { _id: '$userId', requests: { $sum: 1 }, tokens: { $sum: '$tokensEstimate' } } },
      { $sort: { requests: -1 } },
      { $limit: 50 },
    ])
    const userIds = byUser.map(x => x._id)
    const users = await User.find({ _id: { $in: userIds } }).select('name email').lean()
    const umap = Object.fromEntries(users.map(u => [u._id.toString(), u]))
    const byUserHydrated = byUser.map(row => ({
      ...row,
      user: umap[row._id.toString()],
    }))
    res.json({ ok: true, byFeature, byUser: byUserHydrated })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load AI usage' })
  }
})

router.get('/moderation/cases', async (req, res) => {
  try {
    const status = req.query.status || ''
    const filter = {}
    if (status) filter.status = status
    const cases = await ModerationCase.find(filter).sort({ createdAt: -1 }).limit(100)
      .populate('reporterId', 'name email')
      .populate('targetUserId', 'name email avatar')
      .lean()
    res.json({ ok: true, cases })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load moderation cases' })
  }
})

router.post('/moderation/cases', async (req, res) => {
  try {
    const c = await ModerationCase.create(req.body)
    res.status(201).json({ ok: true, case: c })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create case' })
  }
})

router.put('/moderation/cases/:id', async (req, res) => {
  try {
    const c = await ModerationCase.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!c) return res.status(404).json({ error: 'Not found' })
    res.json({ ok: true, case: c })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update case' })
  }
})

router.post('/moderation/scan', async (req, res) => {
  try {
    const text = (req.body.text || '').toString()
    let score = 0
    if (/(.)\1{12,}/.test(text)) score += 35
    score += (text.match(/https?:\/\//g) || []).length * 12
    if (text.length > 400 && text === text.toUpperCase()) score += 20
    const spam = /(viagra|casino|crypto wallet)/i.test(text) ? 40 : 0
    score += spam
    res.json({ ok: true, spamScore: Math.min(100, score), flagged: score >= 40 })
  } catch (err) {
    res.status(500).json({ error: 'Scan failed' })
  }
})

router.post('/notifications/broadcast', async (req, res) => {
  try {
    const { title, message, userIds, broadcastAll } = req.body
    if (!title || !message) return res.status(400).json({ error: 'title and message required' })
    let targets = []
    if (broadcastAll === true) {
      targets = (await User.find().select('_id').lean()).map(u => u._id)
    } else if (Array.isArray(userIds) && userIds.length) {
      targets = userIds.filter(id => mongoose.Types.ObjectId.isValid(id))
    } else {
      return res.status(400).json({ error: 'Use broadcastAll: true or a non-empty userIds array' })
    }
    const batch = targets.map(uid => ({
      userId: uid,
      type: 'admin_broadcast',
      title: title.slice(0, 200),
      message: message.slice(0, 2000),
      read: false,
    }))
    if (batch.length) await Notification.insertMany(batch)
    res.json({ ok: true, sent: batch.length })
  } catch (err) {
    console.error('Broadcast error:', err)
    res.status(500).json({ error: 'Broadcast failed' })
  }
})

router.get('/gamification', async (req, res) => {
  try {
    let doc = await AppSettings.findOne({ key: 'gamification' })
    if (!doc) {
      doc = await AppSettings.create({ key: 'gamification', value: { ...DEFAULT_GAMIFICATION } })
    }
    res.json({ ok: true, settings: doc.value })
  } catch (err) {
    res.status(500).json({ error: 'Failed to load gamification' })
  }
})

router.put('/gamification', async (req, res) => {
  try {
    const existing = await AppSettings.findOne({ key: 'gamification' })
    const prev = existing?.value ? { ...DEFAULT_GAMIFICATION, ...existing.value } : { ...DEFAULT_GAMIFICATION }
    const value = { ...prev, ...req.body }
    if (!Array.isArray(value.customBadges)) value.customBadges = prev.customBadges || []
    const doc = await AppSettings.findOneAndUpdate(
      { key: 'gamification' },
      { value },
      { upsert: true, new: true },
    )
    res.json({ ok: true, settings: doc.value })
  } catch (err) {
    res.status(500).json({ error: 'Failed to save gamification' })
  }
})

router.post('/gamification/badges', async (req, res) => {
  try {
    let doc = await AppSettings.findOne({ key: 'gamification' })
    if (!doc) doc = await AppSettings.create({ key: 'gamification', value: { ...DEFAULT_GAMIFICATION } })
    const badge = {
      id: req.body.id || `badge_${Date.now()}`,
      name: req.body.name || 'Badge',
      description: (req.body.description || '').slice(0, 500),
      icon: req.body.icon || 'ri-award-line',
    }
    doc.value.customBadges = [...(doc.value.customBadges || []), badge]
    await doc.save()
    res.json({ ok: true, settings: doc.value })
  } catch (err) {
    res.status(500).json({ error: 'Failed to add badge' })
  }
})

router.get('/leaderboard/xp', async (req, res) => {
  try {
    const users = await User.find()
      .sort({ totalXP: -1 })
      .limit(100)
      .select('name email avatar totalXP totalStudyHours currentStreak banned')
      .lean()
    res.json({ ok: true, leaderboard: users.map((u, i) => ({ ...u, rank: i + 1 })) })
  } catch (err) {
    res.status(500).json({ error: 'Failed leaderboard' })
  }
})

export default router
