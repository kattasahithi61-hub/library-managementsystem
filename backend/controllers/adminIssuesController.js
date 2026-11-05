import mongoose from 'mongoose'
import Issue from '../models/Issue.js'
import { calculateFine, getIssueStatus } from '../utils/fine.js'

const issueRelations = [
  { path: 'student', select: '_id name registerNumber phone department year active createdAt' },
  { path: 'book', select: '_id title author isbn category publisher description coverImage' },
]
const validStatuses = new Set(['issued', 'returned', 'overdue'])

function serializeIssue(issue, now) {
  const status = getIssueStatus(issue, now)
  return {
    id: issue._id.toString(),
    student: issue.student ? {
      id: issue.student._id.toString(),
      name: issue.student.name,
      registerNumber: issue.student.registerNumber,
      phone: issue.student.phone,
      department: issue.student.department,
      year: issue.student.year,
      active: issue.student.active !== false,
    } : null,
    book: issue.book ? {
      id: issue.book._id.toString(),
      title: issue.book.title,
      author: issue.book.author,
      isbn: issue.book.isbn,
      category: issue.book.category,
      publisher: issue.book.publisher,
      description: issue.book.description,
      coverImage: issue.book.coverImage,
    } : null,
    issueDate: issue.issueDate,
    dueDate: issue.dueDate,
    returnDate: issue.returnDate,
    status,
    fine: issue.status === 'returned' ? issue.fine : calculateFine(issue.dueDate, now),
  }
}

function matchesSearch(issue, query) {
  if (!query) return true
  const normalized = query.toLocaleLowerCase()
  return [
    issue.student?.name,
    issue.student?.registerNumber,
    issue.book?.title,
    issue.book?.isbn,
  ].some((value) => typeof value === 'string' && value.toLocaleLowerCase().includes(normalized))
}

export async function listAdminIssues(req, res) {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const requestedStatus = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : ''
  if (requestedStatus && requestedStatus !== 'all' && !validStatuses.has(requestedStatus)) {
    return res.status(400).json({ message: 'Status must be issued, returned, overdue, or all.' })
  }

  try {
    const records = await Issue.find({})
      .populate(issueRelations)
      .sort({ issueDate: -1, _id: -1 })
      .lean()
    const now = new Date()
    const issues = records
      .map((issue) => serializeIssue(issue, now))
      .filter((issue) => (!requestedStatus || requestedStatus === 'all' || issue.status === requestedStatus)
        && matchesSearch(issue, search))
    return res.status(200).json({ issues })
  } catch (error) {
    console.error('Unable to retrieve admin issue records.', error)
    return res.status(500).json({ message: 'Issue records could not be retrieved.' })
  }
}

export async function getAdminIssue(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'A valid issue ID is required.' })
  }

  try {
    const record = await Issue.findById(req.params.id).populate(issueRelations).lean()
    if (!record) return res.status(404).json({ message: 'Issue record not found.' })
    return res.status(200).json({ issue: serializeIssue(record, new Date()) })
  } catch (error) {
    console.error('Unable to retrieve admin issue details.', error)
    return res.status(500).json({ message: 'Issue details could not be retrieved.' })
  }
}
