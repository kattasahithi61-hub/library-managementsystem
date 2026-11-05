import mongoose from 'mongoose'
import Book from '../models/Book.js'
import Issue from '../models/Issue.js'
import { calculateFine, getDueDate, getIssueStatus } from '../utils/fine.js'

const bookDetails = 'title author isbn category publisher description totalCopies availableCopies coverImage'
const dayMilliseconds = 86_400_000

function isTransactionUnsupported(error) {
  const messages = [error?.message, error?.originalError?.message]
  return error?.code === 20
    || error?.code === 303
    || error?.originalError?.code === 20
    || error?.originalError?.code === 303
    || messages.some((message) => /Transaction numbers are only allowed|does not support transactions|replica set member or mongos/i.test(message || ''))
}

function issueResponse(issue, now = new Date()) {
  const value = typeof issue.toObject === 'function' ? issue.toObject() : issue
  const status = getIssueStatus(value, now)
  return {
    id: value._id.toString(),
    book: value.book,
    issueDate: value.issueDate,
    dueDate: value.dueDate,
    returnDate: value.returnDate,
    status,
    fine: value.status === 'returned' ? value.fine : calculateFine(value.dueDate, now),
  }
}

async function restoreAvailableCopy(bookId) {
  const result = await Book.updateOne(
    { _id: bookId, $expr: { $lt: ['$availableCopies', '$totalCopies'] } },
    { $inc: { availableCopies: 1 } },
  )
  return result.modifiedCount === 1
}

async function createIssueWithTransaction({ bookId, studentId, issueDate, dueDate }) {
  const session = await mongoose.startSession()
  let createdIssue
  try {
    await session.withTransaction(async () => {
      const book = await Book.findOneAndUpdate(
        { _id: bookId, availableCopies: { $gt: 0 } },
        { $inc: { availableCopies: -1 } },
        { returnDocument: 'after', session },
      )
      if (!book) {
        const exists = await Book.exists({ _id: bookId }).session(session)
        const error = new Error(exists ? 'This book is currently unavailable.' : 'Book not found.')
        error.status = exists ? 409 : 404
        throw error
      }

      const [issue] = await Issue.create([{
        book: bookId,
        student: studentId,
        issueDate,
        dueDate,
        status: 'issued',
        fine: 0,
      }], { session })
      createdIssue = issue
    })
    return createdIssue
  } finally {
    await session.endSession()
  }
}

async function createIssueWithCompensation({ bookId, studentId, issueDate, dueDate }) {
  const book = await Book.findOneAndUpdate(
    { _id: bookId, availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { returnDocument: 'after' },
  )
  if (!book) {
    const exists = await Book.exists({ _id: bookId })
    const error = new Error(exists ? 'This book is currently unavailable.' : 'Book not found.')
    error.status = exists ? 409 : 404
    throw error
  }

  try {
    return await Issue.create({
      book: bookId,
      student: studentId,
      issueDate,
      dueDate,
      status: 'issued',
      fine: 0,
    })
  } catch (error) {
    try {
      if (!await restoreAvailableCopy(bookId)) {
        throw new Error('The availability count could not be restored.')
      }
    } catch (restoreError) {
      console.error('CRITICAL: Failed to restore book availability after an issue failure.', {
        bookId: bookId.toString(),
        issueError: error,
        restoreError,
      })
      throw new Error('The issue could not be completed and book availability needs administrative reconciliation.')
    }
    throw error
  }
}

async function createIssue(input) {
  try {
    return await createIssueWithTransaction(input)
  } catch (error) {
    if (!isTransactionUnsupported(error)) throw error
    return createIssueWithCompensation(input)
  }
}

export async function issueBook(req, res) {
  const bookId = req.body?.bookId
  if (typeof bookId !== 'string' || !mongoose.isValidObjectId(bookId)) {
    return res.status(400).json({ message: 'A valid book ID is required.' })
  }
  if (Object.hasOwn(req.body || {}, 'student') || Object.hasOwn(req.body || {}, 'studentId')) {
    return res.status(400).json({ message: 'Student identity is derived from your authenticated account.' })
  }

  const issueDate = new Date()
  const dueDate = getDueDate(issueDate)
  try {
    const issue = await createIssue({ bookId, studentId: req.authenticatedUser._id, issueDate, dueDate })
    await issue.populate({ path: 'book', select: bookDetails })
    return res.status(201).json({ message: 'Book issued successfully.', issue: issueResponse(issue) })
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: 'You already have this book issued.' })
    }
    if (error.status) return res.status(error.status).json({ message: error.message })
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        message: 'The issue request is invalid.',
        errors: Object.fromEntries(Object.entries(error.errors).map(([field, issueError]) => [field, issueError.message])),
      })
    }
    console.error('Unable to issue book.', error)
    return res.status(500).json({ message: error.message || 'The book could not be issued.' })
  }
}

export async function listMyIssues(req, res) {
  try {
    const issues = await Issue.find({ student: req.authenticatedUser._id })
      .populate({ path: 'book', select: bookDetails })
      .sort({ issueDate: -1, _id: -1 })
      .lean()
    const now = new Date()
    return res.status(200).json({ issues: issues.map((issue) => issueResponse(issue, now)) })
  } catch (error) {
    console.error('Unable to retrieve student issues.', error)
    return res.status(500).json({ message: 'Your book issues could not be retrieved.' })
  }
}

export async function getMyIssue(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid issue ID.' })
  try {
    const issue = await Issue.findById(req.params.id)
      .populate({ path: 'book', select: bookDetails })
      .lean()
    if (!issue) return res.status(404).json({ message: 'Issue record not found.' })
    if (issue.student.toString() !== req.authenticatedUser._id.toString()) {
      return res.status(403).json({ message: 'You cannot view another student’s issue record.' })
    }
    return res.status(200).json({ issue: issueResponse(issue) })
  } catch (error) {
    console.error('Unable to retrieve issue record.', error)
    return res.status(500).json({ message: 'The issue record could not be retrieved.' })
  }
}

async function returnIssueWithTransaction({ issueId, studentId, returnDate, fine }) {
  const session = await mongoose.startSession()
  let issue
  try {
    await session.withTransaction(async () => {
      issue = await Issue.findOneAndUpdate(
        { _id: issueId, student: studentId, status: 'issued' },
        { $set: { status: 'returned', returnDate, fine } },
        { returnDocument: 'after', session },
      )
      if (!issue) return
      const restored = await Book.updateOne(
        { _id: issue.book, $expr: { $lt: ['$availableCopies', '$totalCopies'] } },
        { $inc: { availableCopies: 1 } },
        { session },
      )
      if (restored.modifiedCount !== 1) {
        const error = new Error('The issued book is unavailable for return processing.')
        error.status = 409
        throw error
      }
    })
    return issue
  } finally {
    await session.endSession()
  }
}

async function returnIssueWithCompensation({ issueId, studentId, returnDate, fine }) {
  const issue = await Issue.findOneAndUpdate(
    { _id: issueId, student: studentId, status: 'issued' },
    { $set: { status: 'returned', returnDate, fine } },
    { returnDocument: 'after' },
  )
  if (!issue) return null

  try {
    if (!await restoreAvailableCopy(issue.book)) {
      throw new Error('The book no longer exists or its copy count cannot be restored.')
    }
    return issue
  } catch (error) {
    const reverted = await Issue.updateOne(
      { _id: issue._id, student: studentId, status: 'returned', returnDate },
      { $set: { status: 'issued', returnDate: null, fine: 0 } },
    )
    if (reverted.modifiedCount !== 1) {
      console.error('CRITICAL: Failed to roll back a return after book availability could not be restored.', {
        issueId: issue._id.toString(),
        restoreError: error,
      })
      throw new Error('The return could not be completed and needs administrative reconciliation.')
    }
    throw error
  }
}

async function returnIssue(input) {
  try {
    return await returnIssueWithTransaction(input)
  } catch (error) {
    if (!isTransactionUnsupported(error)) throw error
    return returnIssueWithCompensation(input)
  }
}

export async function returnMyIssue(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid issue ID.' })

  try {
    const existing = await Issue.findById(req.params.id).select('student status dueDate').lean()
    if (!existing) return res.status(404).json({ message: 'Issue record not found.' })
    if (existing.student.toString() !== req.authenticatedUser._id.toString()) {
      return res.status(403).json({ message: 'You cannot return another student’s book.' })
    }
    if (existing.status !== 'issued') {
      return res.status(409).json({ message: 'This book has already been returned or is not currently issued.' })
    }

    const returnDate = new Date()
    const fine = calculateFine(existing.dueDate, returnDate)
    const issue = await returnIssue({
      issueId: req.params.id,
      studentId: req.authenticatedUser._id,
      returnDate,
      fine,
    })
    if (!issue) return res.status(409).json({ message: 'This book is no longer currently issued.' })

    await issue.populate({ path: 'book', select: bookDetails })
    return res.status(200).json({ message: 'Book returned successfully.', issue: issueResponse(issue) })
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message })
    console.error('Unable to return book.', error)
    return res.status(500).json({ message: error.message || 'The book could not be returned.' })
  }
}

export async function getStudentDashboard(req, res) {
  try {
    const [available, issues] = await Promise.all([
      Book.aggregate([{ $group: { _id: null, total: { $sum: '$availableCopies' } } }]),
      Issue.find({ student: req.authenticatedUser._id })
        .populate({ path: 'book', select: 'title author' })
        .sort({ issueDate: -1, _id: -1 })
        .lean(),
    ])
    const now = new Date()
    const activeIssues = issues.filter((issue) => issue.status === 'issued')
    const dueSoon = activeIssues.filter((issue) => {
      const days = Math.floor((Date.UTC(issue.dueDate.getUTCFullYear(), issue.dueDate.getUTCMonth(), issue.dueDate.getUTCDate())
        - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / dayMilliseconds)
      return days >= 0 && days <= 3
    })
    const pendingFine = issues.reduce((sum, issue) => (
      sum + (issue.status === 'returned' ? issue.fine : calculateFine(issue.dueDate, now))
    ), 0)
    const issuedBooks = activeIssues.map((issue) => ({
      ...issueResponse(issue, now),
      title: issue.book?.title || 'Book no longer in catalogue',
      author: issue.book?.author || '—',
    }))
    const recentActivity = issues.flatMap((issue) => {
      const title = issue.book?.title || 'Book no longer in catalogue'
      const events = [{
        id: `${issue._id}-issued`,
        type: 'issued',
        title,
        occurredAt: issue.issueDate,
      }]
      if (issue.status === 'returned' && issue.returnDate) {
        events.push({
          id: `${issue._id}-returned`,
          type: 'returned',
          title,
          occurredAt: issue.returnDate,
        })
      }
      return events
    }).sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt)).slice(0, 8)

    return res.status(200).json({
      stats: {
        totalBooksAvailable: available[0]?.total || 0,
        currentlyIssued: activeIssues.length,
        dueSoon: dueSoon.length,
        returnedBooks: issues.filter((issue) => issue.status === 'returned').length,
        pendingFine,
        currency: '₹',
      },
      issuedBooks,
      recentActivity,
    })
  } catch (error) {
    console.error('Unable to retrieve student dashboard data.', error)
    return res.status(500).json({ message: 'Dashboard data could not be retrieved.' })
  }
}
