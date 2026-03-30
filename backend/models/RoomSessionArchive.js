import mongoose from 'mongoose'

const roomSessionArchiveSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true, index: true },
  roomName: { type: String, default: '' },
  subject: { type: String, default: '' },
  createdByName: { type: String, default: '' },
  createdById: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  startedAt: { type: Date, required: true },
  endedAt: { type: Date, required: true },
  duration: { type: Number, default: 0 },
  maxParticipants: { type: Number, default: 0 },
  participantNames: { type: [String], default: [] },
  participants: { type: [mongoose.Schema.Types.Mixed], default: [] },
  chatMessages: { type: [mongoose.Schema.Types.Mixed], default: [] },
  tasks: { type: [mongoose.Schema.Types.Mixed], default: [] },
  sharedNotes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  resources: { type: [mongoose.Schema.Types.Mixed], default: [] },
  folders: { type: [mongoose.Schema.Types.Mixed], default: [] },
  activeQuiz: { type: mongoose.Schema.Types.Mixed, default: null },
  quizResults: { type: [mongoose.Schema.Types.Mixed], default: [] },
  leaderboard: { type: [mongoose.Schema.Types.Mixed], default: [] },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
  expiresAt: { type: Date, required: true },
}, { timestamps: true })

roomSessionArchiveSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const RoomSessionArchive = mongoose.model('RoomSessionArchive', roomSessionArchiveSchema)
export default RoomSessionArchive