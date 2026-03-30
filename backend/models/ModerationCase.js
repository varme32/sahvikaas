import mongoose from 'mongoose'

const moderationCaseSchema = new mongoose.Schema({
  type: { type: String, enum: ['user', 'message', 'resource', 'spam'], default: 'user' },
  status: { type: String, enum: ['open', 'warned', 'banned', 'dismissed', 'resolved'], default: 'open' },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  messageSnapshot: { type: String, default: '' },
  resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', default: null },
  spamScore: { type: Number, default: 0 },
  notes: { type: String, default: '' },
}, { timestamps: true })

moderationCaseSchema.index({ status: 1, createdAt: -1 })

const ModerationCase = mongoose.model('ModerationCase', moderationCaseSchema)
export default ModerationCase
