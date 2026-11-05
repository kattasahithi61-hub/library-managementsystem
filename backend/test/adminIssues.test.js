import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { calculateFine } from '../utils/fine.js'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })
process.env.JWT_SECRET = 'admin-issues-test-secret-not-for-production'

const testUri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/college_library_test'
const testDatabase = new URL(testUri).pathname.replace(/^\//, '')
if (!testDatabase.endsWith('_test')) {
  throw new Error('Tests require a MongoDB database name ending in _test.')
}

const [
  { default: app },
  { default: User },
  { default: Book },
  { default: Issue },
] = await Promise.all([
  import('../app.js'),
  import('../models/User.js'),
  import('../models/Book.js'),
  import('../models/Issue.js'),
])

let server
let baseUrl
let admin
let student
let adminToken
let studentToken
let issuedBook
let returnedBook
let overdueBook
let issuedRecord
let returnedRecord
let overdueRecord

function tokenFor(user) {
  return jwt.sign({ role: user.role }, process.env.JWT_SECRET, {
    subject: user._id.toString(),
    expiresIn: '10m',
  })
}

async function request(path, { method = 'GET', token, body } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function dateOffset(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date
}

before(async () => {
  await mongoose.connect(testUri)
  await Promise.all([User.init(), Book.init(), Issue.init()])

  admin = await User.create({
    name: 'Admin Issues Test Admin',
    registerNumber: 'AIM0000001',
    phone: '1234567890',
    department: 'Computer Science',
    year: 'Fourth year',
    password: await bcrypt.hash('AdminPass1!', 4),
    role: 'admin',
  })
  student = await User.create({
    name: 'Admin Issues Test Student',
    registerNumber: 'AIM0000002',
    phone: '1234567891',
    department: 'Science',
    year: 'Second year',
    password: await bcrypt.hash('StudentPass1!', 4),
    role: 'student',
  })
  issuedBook = await Book.create({
    title: 'Admin Issues Active Record Book',
    author: 'Issue Search Author',
    isbn: 'ADM-ISS-00001',
    category: 'Testing',
    totalCopies: 2,
    availableCopies: 1,
  })
  returnedBook = await Book.create({
    title: 'Admin Issues Returned Record Book',
    author: 'Issue Search Author',
    isbn: 'ADM-ISS-00002',
    category: 'Testing',
    totalCopies: 2,
    availableCopies: 2,
  })
  overdueBook = await Book.create({
    title: 'Admin Issues Overdue Record Book',
    author: 'Issue Search Author',
    isbn: 'ADM-ISS-00003',
    category: 'Testing',
    totalCopies: 2,
    availableCopies: 1,
  })

  const dueTomorrow = dateOffset(1)
  const dueTwoDaysAgo = dateOffset(-2)
  const returnedLate = dateOffset(-1)
  issuedRecord = await Issue.create({
    book: issuedBook._id,
    student: student._id,
    issueDate: dateOffset(-2),
    dueDate: dueTomorrow,
    status: 'issued',
    fine: 0,
  })
  returnedRecord = await Issue.create({
    book: returnedBook._id,
    student: student._id,
    issueDate: dateOffset(-10),
    dueDate: dateOffset(-3),
    returnDate: returnedLate,
    status: 'returned',
    fine: calculateFine(dateOffset(-3), returnedLate),
  })
  overdueRecord = await Issue.create({
    book: overdueBook._id,
    student: student._id,
    issueDate: dateOffset(-16),
    dueDate: dueTwoDaysAgo,
    status: 'issued',
    fine: 0,
  })

  adminToken = tokenFor(admin)
  studentToken = tokenFor(student)
  server = http.createServer(app)
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  if (mongoose.connection.readyState === 1) {
    await Issue.deleteMany({ _id: { $in: [issuedRecord?._id, returnedRecord?._id, overdueRecord?._id].filter(Boolean) } })
    await Book.deleteMany({ _id: { $in: [issuedBook?._id, returnedBook?._id, overdueBook?._id].filter(Boolean) } })
    await User.deleteMany({ _id: { $in: [admin?._id, student?._id].filter(Boolean) } })
    await mongoose.disconnect()
  }
})

test('admin issue records are read-only, scoped to admins, and use backend status/fine rules', async (t) => {
  await t.test('rejects logged-out users and normal students', async () => {
    assert.equal((await request('/api/admin/issues')).status, 401)
    assert.equal((await request('/api/admin/issues', { token: studentToken })).status, 403)
    assert.equal((await request(`/api/admin/issues/${issuedRecord._id}`, { token: studentToken })).status, 403)
  })

  await t.test('admin lists real issues with populated safe student and book data', async () => {
    const response = await request('/api/admin/issues', { token: adminToken })
    const result = await response.json()
    assert.equal(response.status, 200)
    assert.equal(result.issues.length, 3)

    const issued = result.issues.find(({ id }) => id === issuedRecord._id.toString())
    const returned = result.issues.find(({ id }) => id === returnedRecord._id.toString())
    const overdue = result.issues.find(({ id }) => id === overdueRecord._id.toString())
    assert.equal(issued.status, 'issued')
    assert.equal(issued.fine, 0)
    assert.equal(issued.student.name, student.name)
    assert.equal(issued.student.registerNumber, student.registerNumber)
    assert.equal(issued.book.title, issuedBook.title)
    assert.equal(returned.status, 'returned')
    assert.equal(returned.fine, returnedRecord.fine)
    assert.equal(overdue.status, 'overdue')
    assert.equal(overdue.fine, calculateFine(overdueRecord.dueDate))
    for (const record of result.issues) {
      for (const sensitiveField of ['password', 'recoveryPinHash', 'recoveryAttempts', 'recoveryTokenHash']) {
        assert.equal(sensitiveField in record.student, false)
      }
    }
  })

  await t.test('filters by all required statuses and searches student/book data', async () => {
    for (const [status, recordId] of [
      ['issued', issuedRecord._id],
      ['returned', returnedRecord._id],
      ['overdue', overdueRecord._id],
    ]) {
      const response = await request(`/api/admin/issues?status=${status}`, { token: adminToken })
      const result = await response.json()
      assert.equal(response.status, 200)
      assert.ok(result.issues.length >= 1)
      assert.ok(result.issues.every((issue) => issue.status === status))
      assert.ok(result.issues.some((issue) => issue.id === recordId.toString()))
    }

    const byStudent = await request(`/api/admin/issues?search=${student.registerNumber}`, { token: adminToken })
    assert.ok((await byStudent.json()).issues.length >= 3)
    const byBook = await request('/api/admin/issues?search=Active%20Record%20Book', { token: adminToken })
    const bookResults = await byBook.json()
    assert.ok(bookResults.issues.some((issue) => issue.id === issuedRecord._id.toString()))

    assert.equal((await request('/api/admin/issues?status=invalid', { token: adminToken })).status, 400)
  })

  await t.test('admin can view issue details and invalid IDs are rejected', async () => {
    const response = await request(`/api/admin/issues/${returnedRecord._id}`, { token: adminToken })
    const result = await response.json()
    assert.equal(response.status, 200)
    assert.equal(result.issue.student.id, student._id.toString())
    assert.equal(result.issue.book.id, returnedBook._id.toString())
    assert.equal(result.issue.returnDate.toString(), returnedRecord.returnDate.toISOString())
    assert.equal(result.issue.status, 'returned')
    assert.equal(result.issue.fine, returnedRecord.fine)

    assert.equal((await request('/api/admin/issues/not-an-id', { token: adminToken })).status, 400)
    assert.equal((await request(`/api/admin/issues/${new mongoose.Types.ObjectId()}`, { token: adminToken })).status, 404)
  })

  await t.test('normal student issue endpoint continues to return only owned records', async () => {
    const response = await request('/api/issues/my', { token: studentToken })
    const result = await response.json()
    assert.equal(response.status, 200)
    assert.ok(result.issues.every((issue) => issue.id === issuedRecord._id.toString()
      || issue.id === returnedRecord._id.toString()
      || issue.id === overdueRecord._id.toString()))
  })
})
