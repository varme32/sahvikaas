import express from 'express'
import User from '../models/User.js'
import { generateToken, authMiddleware } from '../middleware/auth.js'
import cloudinary, { upload } from '../config/cloudinary.js'

const router = express.Router()

// ─── SIGNUP ───
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' })
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() })
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' })
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
    })
    await user.save()

    const token = generateToken(user._id)
    const safeUser = user.toSafeObject()

    res.status(201).json({ ok: true, token, user: safeUser })
  } catch (err) {
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Server error during signup.' })
  }
})

// ─── LOGIN ───
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' })
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    const token = generateToken(user._id)
    const safeUser = user.toSafeObject()

    res.json({ ok: true, token, user: safeUser })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Server error during login.' })
  }
})

// ─── GET CURRENT USER ───
router.get('/me', authMiddleware, async (req, res) => {
  try {
    res.json({ ok: true, user: req.user.toSafeObject() })
  } catch (err) {
    res.status(500).json({ error: 'Server error.' })
  }
})

// ─── UPDATE PROFILE ───
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, bio, institution, major } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required.' })
    }

    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ error: 'User not found.' })

    user.name = name.trim()
    if (bio !== undefined) user.bio = bio.trim()
    if (institution !== undefined) user.institution = institution.trim()
    if (major !== undefined) user.major = major.trim()

    await user.save()
    res.json({ ok: true, user: user.toSafeObject() })
  } catch (err) {
    console.error('Update profile error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// ─── UPLOAD AVATAR ───
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided.' })
    }

    const user = await User.findById(req.user._id)
    if (!user) return res.status(404).json({ error: 'User not found.' })

    // Delete old avatar from Cloudinary if it exists
    if (user.avatar) {
      try {
        const parts = user.avatar.split('/')
        const publicId = parts.slice(-2).join('/').replace(/\.[^/.]+$/, '')
        await cloudinary.uploader.destroy(publicId)
      } catch { /* ignore cleanup errors */ }
    }

    user.avatar = req.file.path || req.file.secure_url || req.file.url
    await user.save()

    res.json({ ok: true, user: user.toSafeObject() })
  } catch (err) {
    console.error('Avatar upload error:', err)
    res.status(500).json({ error: 'Server error during avatar upload.' })
  }
})

export default router
