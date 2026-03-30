import mongoose from 'mongoose'

const roomSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subject: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  privacy: { type: String, default: 'public' },
  audio: { type: Boolean, default: true },
  video: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  ended: { type: Boolean, default: false },
  endedAt: { type: Date },
  // Session tracking
  duration: { type: Number, default: 0 }, // in minutes
  maxParticipants: { type: Number, default: 0 },
  // Scheduled session support
  scheduledFor: { type: Date }, // if this is a scheduled session
  status: { 
    type: String, 
    enum: ['scheduled', 'active', 'completed', 'cancelled'],
    default: 'active'
  },
}, { timestamps: true })

// Calculate duration when room ends
roomSchema.pre('save', function(next) {
  if (this.isModified('ended') && this.ended && !this.endedAt) {
    this.endedAt = new Date()
    this.status = 'completed'
    // Calculate duration in minutes
    this.duration = Math.round((this.endedAt - this.createdAt) / 60000)
  }
  next()
})

const Room = mongoose.model('Room', roomSchema)
export default Room
