import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import multer from 'multer'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Verify Cloudinary configuration
const cloudinaryConfigured = !!(
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET
)

if (!cloudinaryConfigured) {
  console.error('⚠️  CLOUDINARY NOT CONFIGURED - Missing environment variables:')
  if (!process.env.CLOUDINARY_CLOUD_NAME) console.error('   - CLOUDINARY_CLOUD_NAME')
  if (!process.env.CLOUDINARY_API_KEY) console.error('   - CLOUDINARY_API_KEY')
  if (!process.env.CLOUDINARY_API_SECRET) console.error('   - CLOUDINARY_API_SECRET')
} else {
  console.log('✅ Cloudinary configured:', process.env.CLOUDINARY_CLOUD_NAME)
}

// Configure Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    try {
      // Determine resource type based on file mimetype
      let resourceType = 'raw' // Default for documents
      if (file.mimetype.startsWith('image/')) {
        resourceType = 'image'
      } else if (file.mimetype.startsWith('video/')) {
        resourceType = 'video'
      }

      // Generate a safe public_id
      const timestamp = Date.now()
      const safeName = file.originalname
        .replace(/\.[^/.]+$/, '') // Remove extension
        .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace special chars
        .substring(0, 100) // Limit length

      return {
        folder: 'studyhub-resources',
        resource_type: resourceType,
        public_id: `${timestamp}-${safeName}`,
        // Don't specify allowed_formats - let Cloudinary handle it
      }
    } catch (error) {
      console.error('Cloudinary params error:', error)
      throw error
    }
  },
})

// Create multer upload instance
export const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Accept all file types
    cb(null, true)
  },
})

export default cloudinary
