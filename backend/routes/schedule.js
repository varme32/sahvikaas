import express from 'express'
import { authMiddleware } from '../middleware/auth.js'
import StudySession from '../models/StudySession.js'
import Exam from '../models/Exam.js'
import Event from '../models/Event.js'
import Reminder from '../models/Reminder.js'

const router = express.Router()

// ═══════════════════════════════════════════
// SESSIONS
// ═══════════════════════════════════════════

router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const sessions = await StudySession.find({ userId: req.user._id }).sort({ date: 1 })
    res.json({ ok: true, sessions })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch sessions.' })
  }
})

router.post('/sessions', authMiddleware, async (req, res) => {
  try {
    const { title, subject, date, time, duration, type, location, notes, colorIdx } = req.body
    if (!title || !date) return res.status(400).json({ error: 'Title and date are required.' })

    const session = new StudySession({
      userId: req.user._id,
      title, subject, date, time, duration, type, location, notes,
      colorIdx: colorIdx ?? Math.floor(Math.random() * 10),
    })
    await session.save()
    res.status(201).json({ ok: true, session })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session.' })
  }
})

router.put('/sessions/:id', authMiddleware, async (req, res) => {
  try {
    const session = await StudySession.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true }
    )
    if (!session) return res.status(404).json({ error: 'Session not found.' })
    res.json({ ok: true, session })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update session.' })
  }
})

router.delete('/sessions/:id', authMiddleware, async (req, res) => {
  try {
    const session = await StudySession.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
    if (!session) return res.status(404).json({ error: 'Session not found.' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session.' })
  }
})

// ═══════════════════════════════════════════
// EXAMS
// ═══════════════════════════════════════════

router.get('/exams', authMiddleware, async (req, res) => {
  try {
    const exams = await Exam.find({ userId: req.user._id }).sort({ date: 1 })
    res.json({ ok: true, exams })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch exams.' })
  }
})

router.post('/exams', authMiddleware, async (req, res) => {
  try {
    const { subject, date, time, venue, type, units, syllabusProgress, notes, colorIdx } = req.body
    if (!subject || !date) return res.status(400).json({ error: 'Subject and date are required.' })

    const exam = new Exam({
      userId: req.user._id,
      subject, date, time, venue, type, units, syllabusProgress, notes,
      colorIdx: colorIdx ?? Math.floor(Math.random() * 10),
    })
    await exam.save()
    res.status(201).json({ ok: true, exam })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create exam.' })
  }
})

router.put('/exams/:id', authMiddleware, async (req, res) => {
  try {
    const exam = await Exam.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true }
    )
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })
    res.json({ ok: true, exam })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update exam.' })
  }
})

router.delete('/exams/:id', authMiddleware, async (req, res) => {
  try {
    const exam = await Exam.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
    if (!exam) return res.status(404).json({ error: 'Exam not found.' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete exam.' })
  }
})

// ═══════════════════════════════════════════
// EVENTS
// ═══════════════════════════════════════════

router.get('/events', authMiddleware, async (req, res) => {
  try {
    const events = await Event.find({ userId: req.user._id }).sort({ date: 1 })
    res.json({ ok: true, events })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch events.' })
  }
})

router.post('/events', authMiddleware, async (req, res) => {
  try {
    const { title, date, time, venue, category, desc, colorIdx } = req.body
    if (!title || !date) return res.status(400).json({ error: 'Title and date are required.' })

    const event = new Event({
      userId: req.user._id,
      title, date, time, venue, category, desc,
      colorIdx: colorIdx ?? Math.floor(Math.random() * 10),
    })
    await event.save()
    res.status(201).json({ ok: true, event })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create event.' })
  }
})

router.put('/events/:id', authMiddleware, async (req, res) => {
  try {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true }
    )
    if (!event) return res.status(404).json({ error: 'Event not found.' })
    res.json({ ok: true, event })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update event.' })
  }
})

router.delete('/events/:id', authMiddleware, async (req, res) => {
  try {
    const event = await Event.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
    if (!event) return res.status(404).json({ error: 'Event not found.' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete event.' })
  }
})

// ═══════════════════════════════════════════
// REMINDERS
// ═══════════════════════════════════════════

router.get('/reminders', authMiddleware, async (req, res) => {
  try {
    const reminders = await Reminder.find({ userId: req.user._id }).sort({ date: 1 })
    res.json({ ok: true, reminders })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reminders.' })
  }
})

router.post('/reminders', authMiddleware, async (req, res) => {
  try {
    const { title, date, time, type, priority } = req.body
    if (!title || !date) return res.status(400).json({ error: 'Title and date are required.' })

    const reminder = new Reminder({
      userId: req.user._id,
      title, date, time, type, priority,
    })
    await reminder.save()
    res.status(201).json({ ok: true, reminder })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create reminder.' })
  }
})

router.put('/reminders/:id', authMiddleware, async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true }
    )
    if (!reminder) return res.status(404).json({ error: 'Reminder not found.' })
    res.json({ ok: true, reminder })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update reminder.' })
  }
})

router.delete('/reminders/:id', authMiddleware, async (req, res) => {
  try {
    const reminder = await Reminder.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
    if (!reminder) return res.status(404).json({ error: 'Reminder not found.' })
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete reminder.' })
  }
})

export default router
