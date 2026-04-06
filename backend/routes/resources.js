import express from 'express'
import multer from 'multer'
import path from 'path'
import { authMiddleware } from '../middleware/auth.js'
import Resource, { Folder } from '../models/Resource.js'
import { trackResourceUploaded } from '../services/badgeTrackingService.js'

const router = express.Router()

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'backend/uploads/')
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|ppt|pptx|mp4|jpg|jpeg|png|zip/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    if (extname && mimetype) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type'))
    }
  }
})

// File upload endpoint
router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }
    
    const fileUrl = `/uploads/${req.file.filename}`
    const sizeInMB = (req.file.size / 1024 / 1024).toFixed(2)
    const size = `${sizeInMB} MB`
    
    res.json({
      ok: true,
      fileUrl,
      size,
      filename: req.file.filename,
      originalName: req.file.originalname,
    })
  } catch (err) {
    res.status(500).json({ error: 'File upload failed' })
  }
})

// Get all resources (shared, public)
router.get('/', async (req, res) => {
  try {
    const { category, semester, subject, search, sort } = req.query
    const filter = {}
    if (category && category !== 'all') filter.category = category
    if (semester && semester !== 'All') filter.semester = semester
    if (subject && subject !== 'All') filter.subject = subject
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ]
    }

    let sortOption = { createdAt: -1 }
    if (sort === 'Most Downloaded') sortOption = { downloads: -1 }
    else if (sort === 'Highest Rated') sortOption = { rating: -1 }

    const resources = await Resource.find(filter).sort(sortOption)
    res.json({ ok: true, resources })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch resources.' })
  }
})

// Get featured resources
router.get('/featured', async (req, res) => {
  try {
    const resources = await Resource.find({ featured: true }).sort({ downloads: -1 }).limit(10)
    res.json({ ok: true, resources })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch featured resources.' })
  }
})

// Upload / contribute a resource (authenticated)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, subject, category, semester, type, size, fileUrl, icon, iconColor } = req.body
    if (!title) return res.status(400).json({ error: 'Title is required.' })

    const resource = new Resource({
      title, subject, category, semester, type, size, fileUrl, icon, iconColor,
      contributorId: req.user._id,
      contributorName: req.user.name,
    })
    await resource.save()
    
    // Track badge progress for resource upload
    trackResourceUploaded(req.user._id, type).catch(err => 
      console.error('Badge tracking error:', err)
    )
    
    res.status(201).json({ ok: true, resource })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create resource.' })
  }
})

// Increment download count
router.post('/:id/download', async (req, res) => {
  try {
    const resource = await Resource.findByIdAndUpdate(
      req.params.id,
      { $inc: { downloads: 1 } },
      { new: true }
    )
    if (!resource) return res.status(404).json({ error: 'Resource not found.' })
    res.json({ ok: true, resource })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update download count.' })
  }
})

// Get user's uploaded resources
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const resources = await Resource.find({ contributorId: req.user._id }).sort({ createdAt: -1 })
    res.json({ ok: true, resources })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch your resources.' })
  }
})

// ─── USER RESOURCE MANAGEMENT ───

// Get user's personal resources with folder structure
router.get('/user/library', authMiddleware, async (req, res) => {
  try {
    const { folderId, search, tags, isFavorite } = req.query
    const filter = { userId: req.user._id }
    
    if (folderId) filter.folderId = folderId === 'null' ? null : folderId
    if (isFavorite === 'true') filter.isFavorite = true
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ]
    }
    if (tags) {
      const tagArray = tags.split(',')
      filter.tags = { $in: tagArray }
    }

    const resources = await Resource.find(filter).sort({ createdAt: -1 })
    res.json({ ok: true, resources })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch library.' })
  }
})

// Create user resource
router.post('/user/library', authMiddleware, async (req, res) => {
  try {
    const { title, subject, category, type, size, fileUrl, folderId, tags, notes, icon, iconColor } = req.body
    if (!title) return res.status(400).json({ error: 'Title is required.' })

    const resource = new Resource({
      title, subject, category, type, size, fileUrl, folderId, tags, notes, icon, iconColor,
      userId: req.user._id,
      contributorId: req.user._id,
      contributorName: req.user.name,
    })
    await resource.save()
    res.status(201).json({ ok: true, resource })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create resource.' })
  }
})

// Update user resource
router.put('/user/library/:id', authMiddleware, async (req, res) => {
  try {
    const resource = await Resource.findOne({ _id: req.params.id, userId: req.user._id })
    if (!resource) return res.status(404).json({ error: 'Resource not found.' })

    const { title, subject, category, type, folderId, tags, notes, isFavorite, icon, iconColor } = req.body
    if (title !== undefined) resource.title = title
    if (subject !== undefined) resource.subject = subject
    if (category !== undefined) resource.category = category
    if (type !== undefined) resource.type = type
    if (folderId !== undefined) resource.folderId = folderId
    if (tags !== undefined) resource.tags = tags
    if (notes !== undefined) resource.notes = notes
    if (isFavorite !== undefined) resource.isFavorite = isFavorite
    if (icon !== undefined) resource.icon = icon
    if (iconColor !== undefined) resource.iconColor = iconColor

    await resource.save()
    res.json({ ok: true, resource })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update resource.' })
  }
})

// Delete user resource
router.delete('/user/library/:id', authMiddleware, async (req, res) => {
  try {
    const resource = await Resource.findOneAndDelete({ _id: req.params.id, userId: req.user._id })
    if (!resource) return res.status(404).json({ error: 'Resource not found.' })
    res.json({ ok: true, message: 'Resource deleted.' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete resource.' })
  }
})

// Move resources to folder
router.post('/user/library/move', authMiddleware, async (req, res) => {
  try {
    const { resourceIds, folderId } = req.body
    await Resource.updateMany(
      { _id: { $in: resourceIds }, userId: req.user._id },
      { folderId: folderId || null }
    )
    res.json({ ok: true, message: 'Resources moved.' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to move resources.' })
  }
})

// ─── FOLDER MANAGEMENT ───

// Get user's folders
router.get('/user/folders', authMiddleware, async (req, res) => {
  try {
    const { parentId } = req.query
    const filter = { userId: req.user._id }
    if (parentId) filter.parentId = parentId === 'null' ? null : parentId
    
    const folders = await Folder.find(filter).sort({ createdAt: -1 })
    res.json({ ok: true, folders })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch folders.' })
  }
})

// Create folder
router.post('/user/folders', authMiddleware, async (req, res) => {
  try {
    const { name, parentId, color, icon, description } = req.body
    if (!name) return res.status(400).json({ error: 'Folder name is required.' })

    const folder = new Folder({
      name, parentId, color, icon, description,
      userId: req.user._id,
    })
    await folder.save()
    res.status(201).json({ ok: true, folder })
  } catch (err) {
    res.status(500).json({ error: 'Failed to create folder.' })
  }
})

// Update folder
router.put('/user/folders/:id', authMiddleware, async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.id, userId: req.user._id })
    if (!folder) return res.status(404).json({ error: 'Folder not found.' })

    const { name, color, icon, description } = req.body
    if (name !== undefined) folder.name = name
    if (color !== undefined) folder.color = color
    if (icon !== undefined) folder.icon = icon
    if (description !== undefined) folder.description = description

    await folder.save()
    res.json({ ok: true, folder })
  } catch (err) {
    res.status(500).json({ error: 'Failed to update folder.' })
  }
})

// Delete folder
router.delete('/user/folders/:id', authMiddleware, async (req, res) => {
  try {
    const folder = await Folder.findOne({ _id: req.params.id, userId: req.user._id })
    if (!folder) return res.status(404).json({ error: 'Folder not found.' })

    // Move resources to parent or root
    await Resource.updateMany(
      { folderId: folder._id, userId: req.user._id },
      { folderId: folder.parentId }
    )

    // Delete subfolders recursively
    const deleteSubfolders = async (parentId) => {
      const subfolders = await Folder.find({ parentId, userId: req.user._id })
      for (const subfolder of subfolders) {
        await Resource.updateMany(
          { folderId: subfolder._id, userId: req.user._id },
          { folderId: null }
        )
        await deleteSubfolders(subfolder._id)
        await Folder.deleteOne({ _id: subfolder._id })
      }
    }
    await deleteSubfolders(folder._id)

    await Folder.deleteOne({ _id: folder._id })
    res.json({ ok: true, message: 'Folder deleted.' })
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete folder.' })
  }
})

export default router
