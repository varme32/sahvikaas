import cloudinaryModule from 'cloudinary'
import cloudinaryStoragePkg from 'multer-storage-cloudinary'
import multer from 'multer'

// multer-storage-cloudinary v2.x needs the full module (it accesses cloudinary.v2 internally)
const cloudinary = cloudinaryModule.v2

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
const storage = cloudinaryStoragePkg({
  cloudinary: cloudinaryModule,
  folder: 'studyhub-resources',
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const safeName = file.originalname
      .replace(/\.[^/.]+$/, '')        // Remove extension
      .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace special chars
      .substring(0, 100)               // Limit length
    cb(undefined, `${timestamp}-${safeName}`)
  },
  params: (req, file, cb) => {
    let resourceType = 'raw'
    if (file.mimetype.startsWith('image/')) {
      resourceType = 'image'
    } else if (file.mimetype.startsWith('video/')) {
      resourceType = 'video'
    }
    cb(undefined, { resource_type: resourceType })
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
