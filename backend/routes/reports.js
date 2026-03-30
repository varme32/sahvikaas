import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { authMiddleware } from '../middleware/auth.js'
import ActivityReport from '../models/ActivityReport.js'
import { createUserReport } from '../services/reportService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router = express.Router()

router.post('/request', authMiddleware, async (req, res) => {
  try {
    const rangeDays = Math.min(90, Math.max(7, parseInt(req.body.rangeDays, 10) || 30))
    const format = req.body.format === 'json' ? 'json' : 'pdf'
    const { report, error } = await createUserReport(req.user._id, { rangeDays, format })
    if (error) return res.status(500).json({ error })
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
    console.error('Report request error:', err)
    res.status(500).json({ error: 'Failed to generate report' })
  }
})

router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const reports = await ActivityReport.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('format status reportUrl createdAt aiInsights')
      .lean()
    res.json({ ok: true, reports })
  } catch (err) {
    res.status(500).json({ error: 'Failed to list reports' })
  }
})

router.get('/download/:reportId', authMiddleware, async (req, res) => {
  try {
    const report = await ActivityReport.findById(req.params.reportId)
    if (!report || report.status !== 'completed' || !report.reportUrl) {
      return res.status(404).json({ error: 'Report not found' })
    }
    const isOwner = report.userId.toString() === req.user._id.toString()
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const rel = report.reportUrl.replace(/^\//, '')
    const abs = path.join(__dirname, '..', rel)
    const uploadsRoot = path.join(__dirname, '..', 'uploads')
    if (!abs.startsWith(uploadsRoot) || !fs.existsSync(abs)) {
      return res.status(404).json({ error: 'File missing' })
    }
    res.download(abs, path.basename(abs))
  } catch (err) {
    res.status(500).json({ error: 'Download failed' })
  }
})

router.get('/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user id' })
    }
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const reports = await ActivityReport.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean()
    res.json({ ok: true, reports })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' })
  }
})

export default router
