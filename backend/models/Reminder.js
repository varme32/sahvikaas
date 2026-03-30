import mongoose from 'mongoose'

const reminderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, default: '23:59' },
  type: { type: String, default: 'assignment' },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  done: { type: Boolean, default: false },
}, { timestamps: true })

reminderSchema.index({ userId: 1, done: 1 })

const Reminder = mongoose.model('Reminder', reminderSchema)
export default Reminder
