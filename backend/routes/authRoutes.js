import { Router } from 'express'
import {
  changePassword,
  getCurrentUser,
  login,
  logout,
  register,
  resetPassword,
  setRecoveryPin,
  updateCurrentUser,
  verifyRecoveryDetails,
} from '../controllers/authController.js'
import requireAuthenticatedUser from '../middleware/requireAuthenticatedUser.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', requireAuthenticatedUser, getCurrentUser)
router.put('/me', requireAuthenticatedUser, updateCurrentUser)
router.post('/logout', logout)
router.put('/change-password', requireAuthenticatedUser, changePassword)
router.post('/recovery/verify', verifyRecoveryDetails)
router.post('/recovery/reset', resetPassword)
router.put('/recovery-pin', requireAuthenticatedUser, setRecoveryPin)

export default router
