import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const JWT_SECRET = process.env.JWT_SECRET || 'studyhub-secret-key-change-in-production'
const JWT_EXPIRES_IN = '7d'

export function generateToken(userId) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

export async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth failed: No authorization header')
      return res.status(401).json({ error: 'Authentication required' })
    }

    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)

    const user = await User.findById(decoded.id).select('-password')
    if (!user) {
      console.log('Auth failed: User not found for ID:', decoded.id)
      return res.status(401).json({ error: 'User not found' })
    }

    req.user = user
    next()
  } catch (err) {
    console.error('Auth middleware error:', {
      name: err.name,
      message: err.message
    })
    
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' })
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' })
    }
    // Database or other errors
    return res.status(500).json({ 
      error: 'Authentication error',
      details: err.message 
    })
  }
}
