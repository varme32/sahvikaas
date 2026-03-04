import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import Notification from '../models/Notification.js'

const router = express.Router()

// Get user notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
    res.json({ ok: true, notifications })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications.' })
  }
})

// Get unread count
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, read: false })
    res.json({ ok: true, count })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch count.' })
  }
})

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true }
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification.' })
  }
})

// Mark all as read
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notifications.' })
  }
})

export default router
