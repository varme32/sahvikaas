import mongoose from 'mongoose'

const aiUsageLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  feature: { type: String, required: true },
  tokensEstimate: { type: Number, default: 0 },
  meta: { type: mongoose.Schema.Types.Mixed, default: null },
}, { timestamps: true })

aiUsageLogSchema.index({ userId: 1, createdAt: -1 })
aiUsageLogSchema.index({ feature: 1, createdAt: -1 })

const AiUsageLog = mongoose.model('AiUsageLog', aiUsageLogSchema)
export default AiUsageLog
