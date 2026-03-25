import express from 'express'
import mongoose from 'mongoose'
import User from '../models/User.js'
import Resource from '../models/Resource.js'
import Room from '../models/Room.js'
import RoomSessionArchive from '../models/RoomSessionArchive.js'
import StudySession from '../models/StudySession.js'
import StudyActivity from '../models/StudyActivity.js'
import QuizSession from '../models/QuizSession.js'
import { adminAuthMiddleware } from '../middleware/adminAuth.js'

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
      },
      charts: {
        userSignups: fillDays(userSignups, 30),
        roomCreations: fillDays(roomCreations, 30),
        resourceUploads: fillDays(resourceUploads, 30),
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
      .select('-password')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    res.json({ ok: true, users, total, page, pages: Math.ceil(total / limit) })
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

    const filter = {}
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { contributorName: { $regex: search, $options: 'i' } },
      ]
    }

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
      .populate('createdBy', 'name email')
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
    await room.save()
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

export default router
