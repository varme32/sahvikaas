import { authMiddleware } from './auth.js'

/**
 * Admin middleware — must be used AFTER authMiddleware.
 * Checks that the authenticated user has role === 'admin'.
 */
export function adminMiddleware(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

/**
 * Combined auth + admin check for convenience.
 * Usage: router.get('/admin-route', adminAuthMiddleware, handler)
 */
export const adminAuthMiddleware = [authMiddleware, adminMiddleware]
