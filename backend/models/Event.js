import mongoose from 'mongoose'

const eventSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, default: '' },
  venue: { type: String, default: '' },
  category: { type: String, default: 'Technical' },
  desc: { type: String, default: '' },
  status: { type: String, default: 'upcoming' },
  registered: { type: Boolean, default: false },
  colorIdx: { type: Number, default: 0 },
}, { timestamps: true })

eventSchema.index({ userId: 1, date: 1 })

const Event = mongoose.model('Event', eventSchema)
export default Event
