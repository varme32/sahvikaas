import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  avatar: { type: String, default: null },
  bio: { type: String, default: '' },
  institution: { type: String, default: '' },
  major: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  joinedAt: { type: Date, default: Date.now },
  // Room history
  createdRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
  joinedRooms: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Room' }],
  // Stats
  totalStudyHours: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  totalXP: { type: Number, default: 0 },
  lastStudyDate: { type: Date, default: null },
  lastActiveAt: { type: Date, default: null },
  banned: { type: Boolean, default: false },
  bannedAt: { type: Date, default: null },
  bannedReason: { type: String, default: '' },
  moderationWarnings: { type: Number, default: 0 },
  aiQuota: {
    dailyTokenLimit: { type: Number, default: null },
    monthlyRequestLimit: { type: Number, default: null },
    disabledFeatures: [{ type: String }],
  },
}, { timestamps: true })

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password)
}

// Return safe user object (no password)
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject()
  delete obj.password
  return obj
}

const User = mongoose.model('User', userSchema)
export default User
