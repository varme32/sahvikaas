import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import StudySession from '../models/StudySession.js'
import Exam from '../models/Exam.js'
import Resource from '../models/Resource.js'
import StudyActivity from '../models/StudyActivity.js'

const router = express.Router()

// ─── Dashboard summary (user-specific) ───
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id

    // Active rooms created by user - fetched from in-memory rooms via query param
    // (Rooms are still in-memory for the real-time collaboration; this just shows user stats)

    // Recent resources (last 5 uploaded by user, not everyone)
    const recentResources = await Resource.find({ userId }).sort({ createdAt: -1 }).limit(5)

    // Upcoming sessions (user-specific)
    const today = new Date().toISOString().split('T')[0]
    const upcomingSessions = await StudySession.find({
      userId,
      status: 'upcoming',
      date: { $gte: today },
    }).sort({ date: 1 }).limit(5)

    // Upcoming exams
    const upcomingExams = await Exam.find({
      userId,
      date: { $gte: today },
    }).sort({ date: 1 }).limit(3)

    // Study progress for the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
    const startStr = sevenDaysAgo.toISOString().split('T')[0]

    const activities = await StudyActivity.find({
      userId,
      date: { $gte: startStr },
    }).sort({ date: 1 })

    // Build 7-day progress
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const activityMap = {}
    activities.forEach(a => { activityMap[a.date] = a.hours })

    const studyProgress = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      studyProgress.push({
        day: dayNames[d.getDay()],
        hours: activityMap[dateStr] || 0,
      })
    }

    // Subject distribution from completed sessions
    const completedSessions = await StudySession.find({ userId, status: 'completed' })
    const subjectMap = {}
    completedSessions.forEach(s => {
      if (s.subject) {
        subjectMap[s.subject] = (subjectMap[s.subject] || 0) + (parseFloat(s.duration) || 1)
      }
    })
    const subjectColors = ['#6366f1', '#14b8a6', '#f97316', '#f43f5e', '#8b5cf6', '#06b6d4', '#eab308', '#ec4899']
    const totalSubjectHours = Object.values(subjectMap).reduce((a, b) => a + b, 0) || 1
    const subjectDistribution = Object.entries(subjectMap).map(([name, value], i) => ({
      name,
      value: Math.round((value / totalSubjectHours) * 100),
      color: subjectColors[i % subjectColors.length],
    }))

    res.json({
      ok: true,
      recentResources: recentResources.map(r => ({
        name: r.title,
        size: r.size,
        icon: r.icon || 'ri-file-pdf-2-line',
        color: r.iconColor || 'text-red-500 bg-red-50',
      })),
      upcomingSessions: upcomingSessions.map(s => ({
        name: s.title,
        date: s.date + (s.time ? `, ${s.time}` : ''),
        participants: 0,
      })),
      upcomingExams: upcomingExams.map(e => ({
        subject: e.subject,
        date: e.date,
        type: e.type,
      })),
      studyProgress,
      subjectDistribution,
    })
  } catch (err) {
    console.error('Dashboard summary error:', err)
    res.status(500).json({ error: 'Failed to fetch dashboard data.' })
  }
})

export default router
