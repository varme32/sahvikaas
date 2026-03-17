import mongoose from 'mongoose'

const quizSessionSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  questions: { type: Array, required: true },
  hostName: { type: String, default: 'Host' },
  timeLimit: { type: Number, default: 0 }, // seconds per question, 0 = no limit
  results: { type: Array, default: [] },
  createdAt: { type: Date, default: Date.now, expires: 7200 } // auto-delete after 2 hours
})

export default mongoose.model('QuizSession', quizSessionSchema)
