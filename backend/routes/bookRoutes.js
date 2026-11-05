import { Router } from 'express'
import {
  createBook,
  deleteBook,
  getBook,
  listBooks,
  updateBook,
} from '../controllers/booksController.js'
import requireAdmin from '../middleware/requireAdmin.js'

const router = Router()

router.get('/', listBooks)
router.get('/:id', getBook)
router.post('/', requireAdmin, createBook)
router.put('/:id', requireAdmin, updateBook)
router.delete('/:id', requireAdmin, deleteBook)

export default router
