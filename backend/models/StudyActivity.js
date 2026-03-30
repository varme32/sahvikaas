import mongoose from 'mongoose'

// Tracks daily study activity for streak heatmap
const studyActivitySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  hours: { type: Number, default: 0 },
}, { timestamps: true })

studyActivitySchema.index({ userId: 1, date: 1 }, { unique: true })

const StudyActivity = mongoose.model('StudyActivity', studyActivitySchema)
export default StudyActivity
