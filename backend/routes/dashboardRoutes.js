import { Router } from 'express'
import { getStudentDashboard } from '../controllers/issuesController.js'
import requireStudent from '../middleware/requireStudent.js'

const router = Router()

router.get('/', requireStudent, getStudentDashboard)

export default router
