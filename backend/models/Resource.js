import mongoose from 'mongoose'

const resourceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, default: '' },
  category: { type: String, default: 'notes' },
  semester: { type: String, default: '' },
  type: { type: String, default: 'PDF' },
  size: { type: String, default: '0 KB' },
  fileUrl: { type: String, default: '' },
  icon: { type: String, default: 'ri-file-pdf-2-line' },
  iconColor: { type: String, default: 'text-red-500 bg-red-50' },
  rating: { type: Number, default: 0 },
  totalRatings: { type: Number, default: 0 },
  downloads: { type: Number, default: 0 },
  contributorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  contributorName: { type: String, default: '' },
  featured: { type: Boolean, default: false },
  // User organization fields
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  tags: [{ type: String }],
  notes: { type: String, default: '' },
  isFavorite: { type: Boolean, default: false },
  isPublic: { type: Boolean, default: false },
}, { timestamps: true })

resourceSchema.index({ category: 1, semester: 1 })
resourceSchema.index({ subject: 1 })
resourceSchema.index({ userId: 1, folderId: 1 })
resourceSchema.index({ userId: 1, isFavorite: 1 })

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder', default: null },
  color: { type: String, default: '#6366f1' },
  icon: { type: String, default: 'ri-folder-line' },
  description: { type: String, default: '' },
}, { timestamps: true })

folderSchema.index({ userId: 1, parentId: 1 })

const Resource = mongoose.model('Resource', resourceSchema)
const Folder = mongoose.model('Folder', folderSchema)

export default Resource
export { Folder }
