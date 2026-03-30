import mongoose from 'mongoose'

const examSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, default: '10:00' },
  venue: { type: String, default: '' },
  type: { type: String, default: 'Internal' },
  units: { type: String, default: '' },
  syllabusProgress: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  colorIdx: { type: Number, default: 0 },
}, { timestamps: true })

examSchema.index({ userId: 1, date: 1 })

const Exam = mongoose.model('Exam', examSchema)
export default Exam
