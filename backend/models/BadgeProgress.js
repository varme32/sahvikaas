import mongoose from 'mongoose'

// Tracks per-user progress on each badge
const badgeProgressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  badgeId: { type: Number, required: true },
  current: { type: Number, default: 0 },
}, { timestamps: true })

badgeProgressSchema.index({ userId: 1, badgeId: 1 }, { unique: true })

const BadgeProgress = mongoose.model('BadgeProgress', badgeProgressSchema)
export default BadgeProgress
