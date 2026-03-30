import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, default: 'room_invite' },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
  read: { type: Boolean, default: false },
}, { timestamps: true })

notificationSchema.index({ userId: 1, read: 1 })

const Notification = mongoose.model('Notification', notificationSchema)
export default Notification
