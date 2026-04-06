import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import BadgeProgress from '../models/BadgeProgress.js'
import StudyActivity from '../models/StudyActivity.js'
import User from '../models/User.js'
import { trackStudyHours } from '../services/badgeTrackingService.js'
import { calculateTotalStudyHours } from '../lib/studyTimeUtils.js'

const router = express.Router()

// Badge definitions (static, same for everyone)
const BADGE_DEFINITIONS = [
  { id: 1, name: 'Study Champion', desc: 'Complete 50 study sessions', icon: 'ri-medal-line', color: 'from-[#F2CF7E] to-[#e0bd6c]', bg: 'bg-[#F2CF7E]/10', text: 'text-black', target: 50, unit: 'sessions' },
  { id: 2, name: 'Focus Master', desc: 'Maintain focus for 100 hours', icon: 'ri-focus-3-line', color: 'from-[#F2CF7E] to-[#e0bd6c]', bg: 'bg-[#F2CF7E]/10', text: 'text-black', target: 100, unit: 'hours' },
  { id: 3, name: 'Knowledge Seeker', desc: 'Complete 25 different subjects', icon: 'ri-book-open-line', color: 'from-[#F2CF7E] to-[#e0bd6c]', bg: 'bg-[#F2CF7E]/10', text: 'text-black', target: 25, unit: 'subjects' },
  { id: 4, name: 'Collaboration Star', desc: 'Join 30 study groups', icon: 'ri-team-line', color: 'from-[#F2CF7E] to-[#e0bd6c]', bg: 'bg-[#F2CF7E]/10', text: 'text-black', target: 30, unit: 'groups' },
  { id: 5, name: 'Streak Master', desc: 'Maintain a 30-day study streak', icon: 'ri-fire-line', color: 'from-[#F2CF7E] to-[#e0bd6c]', bg: 'bg-[#F2CF7E]/10', text: 'text-black', target: 30, unit: 'days' },
  { id: 6, name: 'Innovation Pioneer', desc: 'Create 10 study materials', icon: 'ri-lightbulb-line', color: 'from-[#F2CF7E] to-[#e0bd6c]', bg: 'bg-[#F2CF7E]/10', text: 'text-black', target: 10, unit: 'materials' },
  { id: 7, name: 'Quiz Whiz', desc: 'Score 90%+ in 20 quizzes', icon: 'ri-question-answer-line', color: 'from-[#F2CF7E] to-[#e0bd6c]', bg: 'bg-[#F2CF7E]/10', text: 'text-black', target: 20, unit: 'quizzes' },
  { id: 8, name: 'Note Ninja', desc: 'Upload 15 quality notes', icon: 'ri-sticky-note-line', color: 'from-[#F2CF7E] to-[#e0bd6c]', bg: 'bg-[#F2CF7E]/10', text: 'text-black', target: 15, unit: 'notes' },
  { id: 9, name: 'Early Bird', desc: 'Attend 30 morning sessions', icon: 'ri-sun-line', color: 'from-[#F2CF7E] to-[#e0bd6c]', bg: 'bg-[#F2CF7E]/10', text: 'text-black', target: 30, unit: 'sessions' },
  { id: 10, name: 'Night Owl', desc: 'Study 50 late-night hours', icon: 'ri-moon-line', color: 'from-[#F2CF7E] to-[#e0bd6c]', bg: 'bg-[#F2CF7E]/10', text: 'text-black', target: 50, unit: 'hours' },
]

// ─── Get badges with user progress ───
router.get('/badges', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('totalStudyHours')
    const progress = await BadgeProgress.find({ userId: req.user._id })
    const progressMap = {}
    progress.forEach(p => { progressMap[p.badgeId] = p.current })

    // Calculate actual total study hours (same as dashboard)
    const actualTotalHours = await calculateTotalStudyHours(req.user._id, user)
    const userTotalHours = Math.floor(actualTotalHours)
    const focusMasterProgress = progressMap[2] || 0
    
    console.log(`📊 GET /badges - User ${req.user._id}`)
    console.log(`   user.totalStudyHours (DB field): ${user?.totalStudyHours || 0}`)
    console.log(`   actualTotalHours (calculated): ${actualTotalHours}`)
    console.log(`   Focus Master badge (ID 2) current progress: ${focusMasterProgress}`)
    
    // Auto-sync Focus Master badge if out of sync
    if (userTotalHours !== focusMasterProgress) {
      console.log(`🔄 SYNCING Focus Master badge: ${focusMasterProgress} -> ${userTotalHours}`)
      const updated = await BadgeProgress.findOneAndUpdate(
        { userId: req.user._id, badgeId: 2 },
        { $set: { current: userTotalHours } },
        { upsert: true, new: true }
      )
      console.log(`✅ Badge updated in DB:`, updated)
      progressMap[2] = userTotalHours
    } else {
      console.log(`✓ Focus Master badge already in sync`)
    }

    const badges = BADGE_DEFINITIONS.map(b => ({
      ...b,
      current: progressMap[b.id] || 0,
    }))

    res.json({ ok: true, badges })
  } catch (err) {
    console.error('Failed to fetch badges:', err)
    res.status(500).json({ error: 'Failed to fetch badges.' })
  }
})

// ─── Get leaderboard (top users by XP) ───
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await User.find({})
      .sort({ totalXP: -1 })
      .limit(20)
      .select('name totalXP currentStreak')

    const leaderboard = users.map((u, i) => ({
      rank: i + 1,
      name: u.name,
      xp: u.totalXP || 0,
      avatar: u.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
      streak: u.currentStreak || 0,
    }))

    res.json({ ok: true, leaderboard })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard.' })
  }
})

// ─── Get study activity heatmap data (last 84 days) ───
router.get('/activity', authMiddleware, async (req, res) => {
  try {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 83)
    const startStr = startDate.toISOString().split('T')[0]

    const activities = await StudyActivity.find({
      userId: req.user._id,
      date: { $gte: startStr },
    }).sort({ date: 1 })

    const activityMap = {}
    activities.forEach(a => { activityMap[a.date] = a.hours })

    // Build full 84-day array
    const data = []
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      data.push({
        date: dateStr,
        day: d.getDate(),
        month: d.toLocaleString('default', { month: 'short' }),
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()],
        hours: activityMap[dateStr] || 0,
      })
    }

    res.json({ ok: true, activity: data })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity data.' })
  }
})

// ─── Log study activity ───
router.post('/activity', authMiddleware, async (req, res) => {
  try {
    const { date, hours } = req.body
    if (!date || hours === undefined) return res.status(400).json({ error: 'Date and hours required.' })

    await StudyActivity.findOneAndUpdate(
      { userId: req.user._id, date },
      { $inc: { hours } },
      { upsert: true, new: true }
    )

    // Update user stats
    const user = await User.findByIdAndUpdate(
      req.user._id,
      {
        $inc: { totalStudyHours: hours },
        lastStudyDate: new Date(),
      },
      { new: true }
    )

    // Track badge progress for study hours (includes streak calculation)
    trackStudyHours(req.user._id, hours).catch(err => 
      console.error('Badge tracking error:', err)
    )

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to log activity.' })
  }
})

// ─── Get user stats summary ───
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('totalStudyHours currentStreak longestStreak totalXP')
    const badgeProgress = await BadgeProgress.find({ userId: req.user._id })

    const completedBadges = badgeProgress.filter(p => {
      const def = BADGE_DEFINITIONS.find(b => b.id === p.badgeId)
      return def && p.current >= def.target
    }).length

    // Calculate total study hours from all sources
    const totalStudyHours = await calculateTotalStudyHours(req.user._id, user)

    // Calculate global rank based on totalXP
    const usersWithHigherXP = await User.countDocuments({
      totalXP: { $gt: user.totalXP || 0 }
    })
    const rank = usersWithHigherXP + 1

    res.json({
      ok: true,
      stats: {
        totalXP: user.totalXP || 0,
        totalBadges: BADGE_DEFINITIONS.length,
        completedBadges,
        currentStreak: user.currentStreak || 0,
        longestStreak: user.longestStreak || 0,
        totalStudyHours,
        rank: `#${rank}`,
      },
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats.' })
  }
})

// ─── Recalculate all badges for current user ───
router.post('/recalculate', authMiddleware, async (req, res) => {
  try {
    const { recalculateAllBadges, recalculateXP } = await import('../services/badgeTrackingService.js')
    await Promise.all([
      recalculateAllBadges(req.user._id),
      recalculateXP(req.user._id)
    ])
    res.json({ ok: true, message: 'Badges and XP recalculated successfully' })
  } catch (err) {
    console.error('Failed to recalculate badges:', err)
    res.status(500).json({ error: 'Failed to recalculate badges.' })
  }
})

export default router
