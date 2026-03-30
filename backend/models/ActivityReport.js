import mongoose from 'mongoose'

const activityReportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  format: { type: String, enum: ['pdf', 'json'], default: 'pdf' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  reportUrl: { type: String, default: '' },
  summary: { type: mongoose.Schema.Types.Mixed, default: null },
  aiInsights: [{ type: String }],
  errorMessage: { type: String, default: '' },
}, { timestamps: true })

activityReportSchema.index({ userId: 1, createdAt: -1 })

const ActivityReport = mongoose.model('ActivityReport', activityReportSchema)
export default ActivityReport
