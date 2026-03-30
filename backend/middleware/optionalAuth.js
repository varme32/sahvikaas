import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const JWT_SECRET = process.env.JWT_SECRET || 'studyhub-secret-key-change-in-production'

/**
 * Attaches req.user when a valid Bearer token is present; otherwise continues.
 */
export async function optionalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return next()
    const token = authHeader.split(' ')[1]
    const decoded = jwt.verify(token, JWT_SECRET)
    const user = await User.findById(decoded.id).select('-password')
    if (user) req.user = user
  } catch {
    // ignore invalid token for optional auth
  }
  next()
}
