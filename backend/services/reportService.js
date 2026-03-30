import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import User from '../models/User.js'
import StudyActivity from '../models/StudyActivity.js'
import StudySession from '../models/StudySession.js'
import Resource from '../models/Resource.js'
import Room from '../models/Room.js'
import AiUsageLog from '../models/AiUsageLog.js'
import ActivityReport from '../models/ActivityReport.js'
import { generateStudyInsights } from './aiInsightsService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function getReportsDir() {
  const dir = path.join(__dirname, '..', 'uploads', 'reports')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export async function buildUserReportPayload(userId, rangeDays = 30) {
  const uid = new mongoose.Types.ObjectId(userId)
  const user = await User.findById(uid).select('-password').lean()
  if (!user) return null

  const end = new Date()
  const start = new Date(end.getTime() - rangeDays * 24 * 60 * 60 * 1000)
  const startStr = start.toISOString().split('T')[0]

  const activities = await StudyActivity.find({ userId: uid, date: { $gte: startStr } })
    .sort({ date: 1 })
    .lean()

  const studyHoursLast30d = activities.reduce((s, a) => s + (a.hours || 0), 0)

  const completedSessions = await StudySession.find({ userId: uid, status: 'completed' }).lean()
  const subjectMap = {}
  completedSessions.forEach(s => {
    if (s.subject) {
      subjectMap[s.subject] = (subjectMap[s.subject] || 0) + (parseFloat(s.duration) || 1)
    }
  })
  const subjectTotal = Object.values(subjectMap).reduce((a, b) => a + b, 0) || 1
  const subjectDistribution = Object.entries(subjectMap).map(([name, hours]) => ({
    name,
    percent: Math.round((hours / subjectTotal) * 100),
    hours,
  }))

  const resourcesCount = await Resource.countDocuments({ userId: uid })
  const roomsCreated = await Room.countDocuments({ createdBy: uid })
  const roomsJoined = await Room.countDocuments({
    participants: uid,
    createdBy: { $ne: uid },
  })

  const aiAgg = await AiUsageLog.aggregate([
    { $match: { userId: uid, createdAt: { $gte: start } } },
    { $group: { _id: '$feature', requests: { $sum: 1 }, tokens: { $sum: '$tokensEstimate' } } },
    { $sort: { requests: -1 } },
  ])

  return {
    user: {
      name: user.name,
      email: user.email,
      totalStudyHours: user.totalStudyHours,
      totalXP: user.totalXP,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
    },
    rangeDays,
    period: { start: startStr, end: end.toISOString().split('T')[0] },
    studyActivityDaily: activities.map(a => ({ date: a.date, hours: a.hours || 0 })),
    studyHoursLast30d,
    subjectDistribution,
    roomsJoined,
    roomsCreated,
    resourcesUploaded: resourcesCount,
    aiUsageByFeature: aiAgg.map(x => ({
      feature: x._id,
      requests: x.requests,
      tokensEstimate: x.tokens,
    })),
  }
}

async function loadPdfKit() {
  try {
    const mod = await import('pdfkit')
    return mod.default
  } catch {
    return null
  }
}

function writePdf(PDFDocument, reportPayload, insights, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const stream = fs.createWriteStream(outPath)
    doc.pipe(stream)
    const { user, rangeDays, studyHoursLast30d, subjectDistribution, roomsJoined, roomsCreated, resourcesUploaded, aiUsageByFeature, studyActivityDaily } = reportPayload

    doc.fontSize(20).text('Study Activity Report', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(11).text(`Generated: ${new Date().toISOString()}`)
    doc.text(`Student: ${user.name} (${user.email})`)
    doc.moveDown()
    doc.fontSize(14).text('Summary')
    doc.fontSize(11)
    doc.text(`Total study hours (all time): ${user.totalStudyHours}`)
    doc.text(`XP: ${user.totalXP} | Streak: ${user.currentStreak} (longest ${user.longestStreak})`)
    doc.text(`Study hours (last ${rangeDays} days): ${studyHoursLast30d.toFixed(1)}`)
    doc.text(`Rooms created: ${roomsCreated} | Rooms joined (excl. own): ${roomsJoined}`)
    doc.text(`Resources uploaded: ${resourcesUploaded}`)
    doc.moveDown()
    doc.fontSize(14).text('Daily hours (sample)')
    doc.fontSize(9)
    studyActivityDaily.slice(-14).forEach(row => {
      doc.text(`${row.date}: ${row.hours} h`)
    })
    doc.moveDown()
    doc.fontSize(14).text('Subject distribution')
    doc.fontSize(11)
    subjectDistribution.slice(0, 12).forEach(s => {
      doc.text(`${s.name}: ${s.percent}% (~${s.hours.toFixed(1)} h)`)
    })
    doc.moveDown()
    doc.fontSize(14).text('AI usage')
    doc.fontSize(11)
    if (!aiUsageByFeature.length) doc.text('No AI requests in this period.')
    else {
      aiUsageByFeature.slice(0, 15).forEach(a => {
        doc.text(`${a.feature}: ${a.requests} requests, ~${a.tokensEstimate} tokens`)
      })
    }
    doc.moveDown()
    doc.fontSize(14).text('AI insights')
    doc.fontSize(11)
    insights.forEach(line => doc.text(`• ${line}`))
    doc.end()
    stream.on('finish', () => resolve())
    stream.on('error', reject)
  })
}

export async function createUserReport(userId, { rangeDays = 30, format = 'pdf' } = {}) {
  const payload = await buildUserReportPayload(userId, rangeDays)
  if (!payload) return { error: 'User not found' }

  const insights = await generateStudyInsights({
    studyHoursLast30d: payload.studyHoursLast30d,
    subjectDistribution: payload.subjectDistribution,
    roomsJoined: payload.roomsJoined,
    roomsCreated: payload.roomsCreated,
    aiFeatures: payload.aiUsageByFeature?.map(x => x.feature),
    streak: payload.user.currentStreak,
    xp: payload.user.totalXP,
  })

  let useFormat = format === 'json' ? 'json' : 'pdf'
  const report = await ActivityReport.create({
    userId,
    format: useFormat,
    status: 'pending',
    summary: payload,
    aiInsights: insights,
  })

  const dir = getReportsDir()
  const base = `${userId}-${report._id}`
  try {
    if (useFormat === 'json') {
      const jsonPath = path.join(dir, `${base}.json`)
      fs.writeFileSync(jsonPath, JSON.stringify({ ...payload, aiInsights: insights }, null, 2), 'utf8')
      report.reportUrl = `/uploads/reports/${base}.json`
    } else {
      const PDFDocument = await loadPdfKit()
      if (!PDFDocument) {
        const jsonPath = path.join(dir, `${base}.json`)
        fs.writeFileSync(jsonPath, JSON.stringify({ ...payload, aiInsights: insights }, null, 2), 'utf8')
        report.reportUrl = `/uploads/reports/${base}.json`
        report.format = 'json'
      } else {
        const pdfPath = path.join(dir, `${base}.pdf`)
        await writePdf(PDFDocument, payload, insights, pdfPath)
        report.reportUrl = `/uploads/reports/${base}.pdf`
      }
    }
    report.status = 'completed'
    await report.save()
  } catch (err) {
    console.error('Report generation failed:', err)
    report.status = 'failed'
    report.errorMessage = err.message
    await report.save()
    return { error: err.message, report }
  }

  return { report }
}
