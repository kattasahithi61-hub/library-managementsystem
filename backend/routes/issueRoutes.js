import { Router } from 'express'
import {
  getMyIssue,
  issueBook,
  listMyIssues,
  returnMyIssue,
} from '../controllers/issuesController.js'
import requireStudent from '../middleware/requireStudent.js'

const router = Router()

router.use(requireStudent)
router.post('/', issueBook)
router.get('/my', listMyIssues)
router.get('/:id', getMyIssue)
router.put('/:id/return', returnMyIssue)

export default router
