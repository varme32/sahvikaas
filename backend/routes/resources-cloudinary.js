import express from 'express'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import cloudinary, { upload } from '../config/cloudinary.js'
import { authMiddleware } from '../middleware/auth.js'
import Resource, { Folder } from '../models/Resource.js'
import User from '../models/User.js'

const router = express.Router()

function isAllowedProxyUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return false
  let u
  try {
    u = new URL(rawUrl)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  // Allow Cloudinary and same-origin relative URLs only
  const host = (u.hostname || '').toLowerCase()
  if (host === 'res.cloudinary.com' || host.endsWith('.cloudinary.com')) return true
  return false
}

function guessContentType({ url, fallback = 'application/octet-stream' }) {
  try {
    const pathname = new URL(url).pathname || ''
    const ext = pathname.split('.').pop()?.toLowerCase()
    const map = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      mp4: 'video/mp4',
      webm: 'video/webm',
      ogg: 'video/ogg',
      txt: 'text/plain; charset=utf-8',
    }
    return map[ext] || fallback
  } catch {
    return fallback
  }
}

function extractCloudinaryPublicId(cloudinaryUrl) {
  if (!cloudinaryUrl || typeof cloudinaryUrl !== 'string') return null
  // Example:
  // https://res.cloudinary.com/<cloud_name>/<resource_type>/upload/v<version>/<folder>/<public_id>.<ext>
  const m = cloudinaryUrl.match(/\/(image|raw|video)\/upload\/(v\d+\/)?(.+)$/)
  if (!m) return null
  const resourceType = m[1] // 'image' | 'raw' | 'video'
  const version = m[2] || '' // 'v1234567890/' or empty
  const tail = m[3] // '<folder>/<public_id>.<ext>' (public_id can contain '/')
  const publicId = tail.replace(/\.[^/.]+$/, '') // drop extension
  return { publicId, resourceType, version: version.replace(/\//g, '') }
}

// File upload endpoint with Cloudinary
router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  try {
    console.log('Upload request received:', {
      hasFile: !!req.file,
      user: req.user?.name,
      userId: req.user?._id
    })
    
    if (!req.file) {
      console.error('No file in request')
      return res.status(400).json({ error: 'No file uploaded' })
    }
    
    console.log('File uploaded successfully:', {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    })
    
    // Cloudinary provides the URL directly
    const fileUrl = req.file.path // Cloudinary URL
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
    console.error('Upload error details:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    })
    res.status(500).json({ 
      error: 'File upload failed',
      details: err.message,
      cloudinaryConfigured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
    })
  }
})

// Handle multer errors
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('Multer error:', {
      code: err.code,
      message: err.message,
      field: err.field
    })
    return res.status(400).json({ 
      error: err.message,
      code: err.code,
      type: 'MulterError'
    })
  } else if (err) {
    console.error('Upload middleware error:', {
      message: err.message,
      stack: err.stack,
      name: err.name
    })
    return res.status(500).json({ 
      error: err.message || 'Upload failed',
      type: err.name || 'UnknownError',
      cloudinaryConfigured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY)
    })
  }
  next()
})

// Inline proxy for previews (prevents forced downloads / CORS issues).
// IMPORTANT: only allows Cloudinary URLs to avoid SSRF.
router.get('/proxy', async (req, res) => {
  try {
    const url = req.query.url
    console.log('Proxy request for URL:', url)
    
    if (!isAllowedProxyUrl(url)) {
      console.error('URL not allowed:', url)
      return res.status(400).json({ error: 'Invalid or disallowed URL.' })
    }

    // CRITICAL: Set CORS headers FIRST before any other operations
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range')
    res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Content-Type, Content-Disposition')
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      return res.status(200).end()
    }

    // Forward range requests (PDF viewers often request byte ranges)
    const fetchOptions = {
      headers: {
        ...(req.headers.range ? { range: req.headers.range } : {}),
        ...(req.headers.accept ? { accept: req.headers.accept } : {}),
        ...(req.headers['user-agent'] ? { 'user-agent': req.headers['user-agent'] } : {}),
      },
      redirect: 'follow',
    }

    let upstream = await fetch(url, fetchOptions)
    console.log('Initial fetch status:', upstream.status, upstream.statusText)

    // For Cloudinary URLs, generate signed URLs when needed
    // (auth failures or raw resource type which forces attachment download)
    const extracted = extractCloudinaryPublicId(url)
    
    if (extracted?.publicId && (upstream.status === 401 || upstream.status === 403 || extracted.resourceType === 'raw')) {
      console.log('Extracted public ID:', extracted)
      
      try {
        // Try different resource types since files might be uploaded with wrong type
        const resourceTypesToTry = [
          extracted.resourceType, // Try the detected type first
          'raw',                  // Then try raw (for PDFs, docs)
          'image',                // Then try image
          'video'                 // Finally try video
        ]
        
        // Remove duplicates
        const uniqueTypes = [...new Set(resourceTypesToTry)]
        
        for (const resType of uniqueTypes) {
          console.log('Trying resource type:', resType)
          
          // Generate a signed URL WITHOUT any transformations.
          // The proxy itself handles Content-Disposition: inline,
          // so we don't need Cloudinary flags. Previously fl_attachment
          // was used here by mistake which FORCED downloads.
          const signedUrl = cloudinary.url(extracted.publicId, {
            type: 'upload',
            sign_url: true,
            secure: true,
            resource_type: resType,
          })

          console.log('Generated signed URL:', signedUrl)
          const retry = await fetch(signedUrl, fetchOptions)
          console.log(`Retry with ${resType}:`, retry.status)
          
          if (retry.ok) {
            upstream = retry
            break
          }
        }
      } catch (e) {
        console.error('Signing error:', e)
        // If signing fails, we'll use the original response
      }
    }

    if (!upstream.ok) {
      return res
        .status(upstream.status)
        .json({
          error: 'Failed to fetch resource.',
          upstreamStatus: upstream.status,
          upstreamStatusText: upstream.statusText,
          url,
        })
    }

    // Get the body as a buffer FIRST to have full control over response
    const buffer = Buffer.from(await upstream.arrayBuffer())

    const upstreamType = upstream.headers.get('content-type') || ''
    // Guess content type from the URL extension
    let guessed = guessContentType({ url })
    
    // If the guessed type is still generic, try to detect from the buffer (magic bytes)
    if (guessed === 'application/octet-stream' && buffer.length >= 5) {
      // PDF magic bytes: %PDF-
      if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46 && buffer[4] === 0x2D) {
        guessed = 'application/pdf'
      }
      // PNG magic bytes
      else if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        guessed = 'image/png'
      }
      // JPEG magic bytes
      else if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        guessed = 'image/jpeg'
      }
      // Check if it looks like text (high ratio of printable ASCII)
      else {
        let printable = 0
        const sampleSize = Math.min(buffer.length, 512)
        for (let i = 0; i < sampleSize; i++) {
          if ((buffer[i] >= 0x20 && buffer[i] <= 0x7E) || buffer[i] === 0x0A || buffer[i] === 0x0D || buffer[i] === 0x09) {
            printable++
          }
        }
        if (printable / sampleSize > 0.85) {
          guessed = 'text/plain; charset=utf-8'
        }
      }
    }

    // Prefer the extension-derived / magic-byte type over application/octet-stream so that
    // files Cloudinary stored as 'raw' (PDFs, docs, etc.) render inline instead
    // of being force-downloaded by the browser.
    const isGeneric = !upstreamType || upstreamType === 'application/octet-stream'
    const contentType = isGeneric ? guessed : upstreamType

    console.log('Content-Type:', contentType, '(upstream:', upstreamType, ', guessed:', guessed, ')')

    // Set response status and headers
    res.status(upstream.status)
    res.setHeader('Content-Type', contentType)
    
    // ALWAYS force inline display — this is the whole point of the proxy
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('X-Content-Type-Options', 'nosniff')

    const contentLength = buffer.length
    res.setHeader('Content-Length', contentLength)

    console.log('Final response headers:', {
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'Content-Length': contentLength,
    })
    console.log('Sending buffer of size:', buffer.length, 'bytes')
    
    // Send the response with our headers
    res.send(buffer)
  } catch (err) {
    console.error('Proxy error:', err)
    res.status(500).json({
      error: 'Failed to proxy resource.',
      details: err instanceof Error ? err.message : String(err),
    })
  }
})

// Proxy endpoint to serve files with inline content-disposition
router.get('/view/:resourceId', async (req, res) => {
  try {
    // Get token from query parameter (since it's a new window)
    const token = req.query.token
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'studyhub-secret-key-change-in-production')
    const user = await User.findById(decoded.id)
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    const resource = await Resource.findOne({ 
      _id: req.params.resourceId, 
      userId: user._id 
    })
    
    if (!resource) {
      return res.status(404).send('Resource not found')
    }

    if (!resource.fileUrl) {
      return res.status(404).send('File URL not found')
    }

    // Fetch file from Cloudinary
    const response = await fetch(resource.fileUrl)
    
    if (!response.ok) {
      return res.status(404).send('File not found in storage')
    }

    // Determine content type based on file extension
    let contentType = 'application/octet-stream'
    const ext = resource.title.split('.').pop().toLowerCase()
    
    const contentTypes = {
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    }
    
    contentType = contentTypes[ext] || contentType
    
    // IMPORTANT: Set headers BEFORE sending data
    res.setHeader('Content-Type', contentType)
    res.setHeader('Content-Disposition', 'inline')
    res.setHeader('Cache-Control', 'public, max-age=31536000')
    
    // Stream the file
    const buffer = await response.arrayBuffer()
    res.send(Buffer.from(buffer))
  } catch (err) {
    console.error('View error:', err)
    res.status(500).send('Failed to load file')
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

    // Get resource counts for each folder
    const folderIds = folders.map(f => f._id)
    const counts = await Resource.aggregate([
      { $match: { userId: req.user._id, folderId: { $in: folderIds } } },
      { $group: { _id: '$folderId', count: { $sum: 1 } } }
    ])
    const countMap = {}
    counts.forEach(c => { countMap[c._id.toString()] = c.count })

    const foldersWithCounts = folders.map(f => ({
      ...f.toObject(),
      resourceCount: countMap[f._id.toString()] || 0,
    }))

    res.json({ ok: true, folders: foldersWithCounts })
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
