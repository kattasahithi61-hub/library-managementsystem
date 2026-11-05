import { Router } from 'express'
import { listBooks } from '../controllers/booksController.js'
import {
  getAdminIssue,
  listAdminIssues,
} from '../controllers/adminIssuesController.js'
import {
  getStudentDetails,
  listStudents,
  updateStudentStatus,
} from '../controllers/adminStudentsController.js'
import requireAdmin from '../middleware/requireAdmin.js'

const router = Router()

router.use(requireAdmin)
router.get('/books', listBooks)
router.get('/issues', listAdminIssues)
router.get('/issues/:id', getAdminIssue)
router.get('/students', listStudents)
router.get('/students/:id', getStudentDetails)
router.put('/students/:id/status', updateStudentStatus)

export default router
