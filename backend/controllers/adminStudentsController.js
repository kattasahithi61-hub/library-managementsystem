import mongoose from 'mongoose'
import Issue from '../models/Issue.js'
import User from '../models/User.js'
import { calculateFine, getIssueStatus } from '../utils/fine.js'

const studentFields = '_id name registerNumber phone department year active createdAt'

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function serializeStudent(student, activeIssuesCount = 0) {
  return {
    id: student._id.toString(),
    name: student.name,
    registerNumber: student.registerNumber,
    phone: student.phone,
    department: student.department,
    year: student.year,
    active: student.active !== false,
    createdAt: student.createdAt,
    activeIssuesCount,
  }
}

function getStudentId(req, res) {
  const { id } = req.params
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ message: 'A valid student ID is required.' })
    return null
  }
  return new mongoose.Types.ObjectId(id)
}

export async function listStudents(req, res) {
  const query = typeof req.query.search === 'string' ? req.query.search.trim() : ''
  const studentFilter = { role: 'student' }
  if (query) {
    const search = new RegExp(escapeRegex(query), 'i')
    studentFilter.$or = [
      { name: search },
      { registerNumber: search },
      { phone: search },
    ]
  }

  try {
    const students = await User.find(studentFilter)
      .select(studentFields)
      .sort({ name: 1, _id: 1 })
      .lean()
    const studentIds = students.map((student) => student._id)
    const activeIssueCounts = await Issue.aggregate([
      { $match: { student: { $in: studentIds }, status: 'issued' } },
      { $group: { _id: '$student', count: { $sum: 1 } } },
    ])
    const countByStudent = new Map(activeIssueCounts.map(({ _id, count }) => [_id.toString(), count]))
    return res.status(200).json({
      students: students.map((student) => serializeStudent(student, countByStudent.get(student._id.toString()) || 0)),
    })
  } catch (error) {
    console.error('Unable to retrieve admin student list.', error)
    return res.status(500).json({ message: 'Students could not be retrieved.' })
  }
}

export async function getStudentDetails(req, res) {
  const studentId = getStudentId(req, res)
  if (!studentId) return

  try {
    const student = await User.findOne({ _id: studentId, role: 'student' }).select(studentFields).lean()
    if (!student) return res.status(404).json({ message: 'Student not found.' })

    const issues = await Issue.find({ student: studentId })
      .select('issueDate dueDate returnDate status fine')
      .lean()
    const now = new Date()
    const summary = issues.reduce((result, issue) => {
      const status = getIssueStatus(issue, now)
      result.totalBooksIssued += 1
      if (status === 'returned') result.returnedBooks += 1
      else result.currentlyIssued += 1
      if (status === 'overdue') result.overdueBooks += 1
      result.totalFines += issue.status === 'returned'
        ? issue.fine
        : calculateFine(issue.dueDate, now)
      return result
    }, {
      totalBooksIssued: 0,
      currentlyIssued: 0,
      returnedBooks: 0,
      overdueBooks: 0,
      totalFines: 0,
    })

    return res.status(200).json({ student: serializeStudent(student, summary.currentlyIssued), summary })
  } catch (error) {
    console.error('Unable to retrieve admin student details.', error)
    return res.status(500).json({ message: 'Student details could not be retrieved.' })
  }
}

export async function updateStudentStatus(req, res) {
  const studentId = getStudentId(req, res)
  if (!studentId) return

  if (
    !req.body
    || typeof req.body !== 'object'
    || Array.isArray(req.body)
    || Object.keys(req.body).length !== 1
    || typeof req.body.active !== 'boolean'
  ) {
    return res.status(400).json({ message: 'Provide only an active boolean status.' })
  }
  if (studentId.toString() === req.authenticatedUser._id.toString()) {
    return res.status(403).json({ message: 'Administrators cannot change their own status here.' })
  }

  try {
    const student = await User.findOneAndUpdate(
      { _id: studentId, role: 'student' },
      { $set: { active: req.body.active } },
      { returnDocument: 'after', runValidators: true },
    ).select(studentFields).lean()
    if (!student) return res.status(404).json({ message: 'Student not found.' })
    const activeIssuesCount = await Issue.countDocuments({ student: studentId, status: 'issued' })
    return res.status(200).json({
      message: `Student account ${student.active ? 'activated' : 'deactivated'} successfully.`,
      student: serializeStudent(student, activeIssuesCount),
    })
  } catch (error) {
    console.error('Unable to update student account status.', error)
    return res.status(500).json({ message: 'Student status could not be updated.' })
  }
}
