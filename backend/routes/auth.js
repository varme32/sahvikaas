import express from 'express'
import crypto from 'crypto'
import User from '../models/User.js'
import { generateToken, authMiddleware } from '../middleware/auth.js'
import cloudinary, { upload } from '../config/cloudinary.js'

const router = express.Router()

// ─── EMAILJS REST API SENDER ───
// Docs: https://www.emailjs.com/docs/rest-api/send/
async function sendOtpViaEmailJS({ toEmail, toName, otp }) {
  const serviceId  = process.env.EMAILJS_SERVICE_ID
  const templateId = process.env.EMAILJS_TEMPLATE_ID
  const publicKey  = process.env.EMAILJS_PUBLIC_KEY
  const privateKey = process.env.EMAILJS_PRIVATE_KEY

  if (!serviceId || !templateId || !publicKey) {
    throw new Error('EmailJS is not configured. Set EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY in backend/.env')
  }

  const payload = {
    service_id:  serviceId,
    template_id: templateId,
    user_id:     publicKey,
    ...(privateKey ? { accessToken: privateKey } : {}),
    template_params: {
      // Use multiple common EmailJS recipient variable names as fallbacks
      to_email:  toEmail,
      email:     toEmail,   // some templates use {{email}}
      reply_to:  toEmail,   // some services use reply_to as recipient
      to_name:   toName,
      name:      toName,
      otp_code:  otp,
      app_name:  'StudyHub',
      expiry:    '15 minutes',
    },
  }

  const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`EmailJS error ${res.status}: ${text}`)
  }

  return true
}

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

    if (user.isGoogleUser && !user.password) {
      return res.status(400).json({ error: 'This account uses Google Sign-In. Please sign in with Google.' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    if (user.banned) {
      return res.status(403).json({ error: 'This account has been suspended.' })
    }

    user.lastActiveAt = new Date()
    await user.save()

    const token = generateToken(user._id)
    const safeUser = user.toSafeObject()

    res.json({ ok: true, token, user: safeUser })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Server error during login.' })
  }
})

// ─── FORGOT PASSWORD ───
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' })
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
    // Always respond ok so we don't reveal if an account exists
    if (!user) {
      return res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' })
    }

    if (user.isGoogleUser && !user.password) {
      return res.status(400).json({ error: 'This account uses Google Sign-In and has no password to reset.' })
    }

    // Generate a secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString()
    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex')

    user.resetPasswordToken = hashedOtp
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    await user.save()

    // Send OTP email via EmailJS
    try {
      await sendOtpViaEmailJS({ toEmail: user.email, toName: user.name, otp })
      console.log(`Password reset OTP sent via EmailJS to: ${user.email}`)
    } catch (emailErr) {
      console.error('EmailJS send failed:', emailErr.message)
      // Clear token so the user isn't stuck
      user.resetPasswordToken = null
      user.resetPasswordExpires = null
      await user.save()
      return res.status(500).json({ error: `Failed to send OTP email: ${emailErr.message}` })
    }

    res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' })
  } catch (err) {
    console.error('Forgot password error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// ─── VERIFY RESET OTP ───
router.post('/verify-reset-otp', async (req, res) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' })
    }

    const hashedOtp = crypto.createHash('sha256').update(otp.trim()).digest('hex')
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetPasswordToken: hashedOtp,
      resetPasswordExpires: { $gt: new Date() },
    })

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' })
    }

    // Generate a temporary session token for the reset step
    const resetSessionToken = crypto.randomBytes(32).toString('hex')
    user.resetPasswordToken = crypto.createHash('sha256').update(resetSessionToken).digest('hex')
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes to set password
    await user.save()

    res.json({ ok: true, resetToken: resetSessionToken })
  } catch (err) {
    console.error('Verify OTP error:', err)
    res.status(500).json({ error: 'Server error.' })
  }
})

// ─── RESET PASSWORD ───
router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body
    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ error: 'All fields are required.' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' })
    }

    const hashedToken = crypto.createHash('sha256').update(resetToken.trim()).digest('hex')
    const user = await User.findOne({
      email: email.toLowerCase().trim(),
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    })

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset session. Please try again.' })
    }

    user.password = newPassword
    user.resetPasswordToken = null
    user.resetPasswordExpires = null
    await user.save()

    const token = generateToken(user._id)
    const safeUser = user.toSafeObject()

    res.json({ ok: true, message: 'Password reset successfully.', token, user: safeUser })
  } catch (err) {
    console.error('Reset password error:', err)
    res.status(500).json({ error: 'Server error during password reset.' })
  }
})

// ─── GOOGLE OAUTH CALLBACK (token exchange) ───
// Called from the frontend after Google redirects back with the auth code
router.post('/google', async (req, res) => {
  try {
    const { googleId, email, name, avatar } = req.body
    if (!googleId || !email) {
      return res.status(400).json({ error: 'Google ID and email are required.' })
    }

    let user = await User.findOne({ googleId })

    if (!user) {
      // Check if there's an existing account with this email
      user = await User.findOne({ email: email.toLowerCase().trim() })
      if (user) {
        // Link google ID to existing account
        user.googleId = googleId
        user.isGoogleUser = true
        if (!user.avatar && avatar) user.avatar = avatar
        await user.save()
      } else {
        // Create new user
        user = new User({
          name: name || email.split('@')[0],
          email: email.toLowerCase().trim(),
          googleId,
          isGoogleUser: true,
          avatar: avatar || null,
        })
        await user.save()
      }
    }

    if (user.banned) {
      return res.status(403).json({ error: 'This account has been suspended.' })
    }

    user.lastActiveAt = new Date()
    await user.save()

    const token = generateToken(user._id)
    const safeUser = user.toSafeObject()

    res.json({ ok: true, token, user: safeUser })
  } catch (err) {
    console.error('Google auth error:', err)
    res.status(500).json({ error: 'Server error during Google authentication.' })
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
