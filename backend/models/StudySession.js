import mongoose from 'mongoose'

const studySessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  subject: { type: String, default: '' },
  date: { type: String, required: true }, // YYYY-MM-DD
  time: { type: String, default: '' },
  duration: { type: String, default: '1h' },
  type: { type: String, default: 'Study' },
  location: { type: String, default: '' },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['upcoming', 'completed'], default: 'upcoming' },
  colorIdx: { type: Number, default: 0 },
}, { timestamps: true })

studySessionSchema.index({ userId: 1, date: 1 })

const StudySession = mongoose.model('StudySession', studySessionSchema)
export default StudySession
