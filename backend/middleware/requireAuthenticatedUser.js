import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const authCookieName = () => process.env.AUTH_COOKIE_NAME || 'library_auth'

function getToken(req) {
  const authorization = req.get('authorization')
  if (authorization?.startsWith('Bearer ')) return authorization.slice(7)
  return req.cookies?.[authCookieName()]
}

export default async function requireAuthenticatedUser(req, res, next) {
  const token = getToken(req)
  if (!token) return res.status(401).json({ message: 'Authentication is required.' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    if (typeof payload !== 'object' || typeof payload.sub !== 'string') {
      return res.status(401).json({ message: 'Your session is invalid. Please sign in again.' })
    }

    const user = await User.findById(payload.sub).select('_id role active').lean()
    if (!user || user.role !== payload.role) {
      return res.status(401).json({ message: 'Your session is no longer valid. Please sign in again.' })
    }
    if (user.active === false) return res.status(403).json({ message: 'This account is inactive.' })

    req.authenticatedUser = user
    return next()
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ message: 'Your session is invalid or has expired. Please sign in again.' })
    }

    console.error('Unable to verify authenticated user session.', error)
    return res.status(500).json({ message: 'Your session could not be verified.' })
  }
}
