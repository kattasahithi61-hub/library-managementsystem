import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })
process.env.JWT_SECRET = 'issue-workflow-test-secret-not-for-production'

const testUri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/college_library_test'
const testDatabase = new URL(testUri).pathname.replace(/^\//, '')
if (!testDatabase.endsWith('_test')) {
  throw new Error('Tests require a MongoDB database name ending in _test.')
}

const [{ default: app }, { default: User }, { default: Book }, { default: Issue }] = await Promise.all([
  import('../app.js'),
  import('../models/User.js'),
  import('../models/Book.js'),
  import('../models/Issue.js'),
])

let server
let baseUrl
let student
let otherStudent
let recoveryStudent
let lockedRecoveryStudent
let registeredStudent
let book
let unavailableBook
let raceBook
let studentToken
let otherStudentToken

function tokenFor(user) {
  return jwt.sign({ role: 'student' }, process.env.JWT_SECRET, {
    subject: user._id.toString(),
    expiresIn: '10m',
  })
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

async function request(path, { method = 'GET', token, body } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: token ? authHeaders(token) : { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

before(async () => {
  await mongoose.connect(testUri)
  await Promise.all([User.init(), Book.init(), Issue.init()])

  student = await User.create({
    name: 'Issue Workflow Test Student',
    registerNumber: 'TST0000001',
    phone: '1234567890',
    department: 'Computer Science',
    year: 'First year',
    password: 'test-password-hash',
    role: 'student',
  })
  otherStudent = await User.create({
    name: 'Issue Workflow Other Student',
    registerNumber: 'TST0000002',
    phone: '1234567891',
    department: 'Computer Science',
    year: 'First year',
    password: 'test-password-hash',
    role: 'student',
  })
  recoveryStudent = await User.create({
    name: 'Recovery Workflow Test Student',
    registerNumber: 'TST0000003',
    phone: '1234567892',
    department: 'Computer Science',
    year: 'First year',
    password: await bcrypt.hash('OriginalPass1!', 4),
    recoveryPinHash: await bcrypt.hash('123456', 4),
    role: 'student',
  })
  lockedRecoveryStudent = await User.create({
    name: 'Locked Recovery Test Student',
    registerNumber: 'TST0000004',
    phone: '1234567893',
    department: 'Computer Science',
    year: 'First year',
    password: 'test-password-hash',
    recoveryPinHash: await bcrypt.hash('654321', 4),
    role: 'student',
  })
  book = await Book.create({
    title: 'Workflow Test Book',
    author: 'Test Author',
    isbn: 'TST-ISBN-00001',
    category: 'Testing',
    totalCopies: 2,
    availableCopies: 2,
  })
  unavailableBook = await Book.create({
    title: 'Unavailable Workflow Test Book',
    author: 'Test Author',
    isbn: 'TST-ISBN-00002',
    category: 'Testing',
    totalCopies: 1,
    availableCopies: 0,
  })
  raceBook = await Book.create({
    title: 'Concurrent Workflow Test Book',
    author: 'Test Author',
    isbn: 'TST-ISBN-00003',
    category: 'Testing',
    totalCopies: 1,
    availableCopies: 1,
  })
  studentToken = tokenFor(student)
  otherStudentToken = tokenFor(otherStudent)
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
    await Promise.all([
      Issue.deleteMany({ student: { $in: [student?._id, otherStudent?._id].filter(Boolean) } }),
      Book.deleteMany({ _id: { $in: [book?._id, unavailableBook?._id, raceBook?._id].filter(Boolean) } }),
      User.deleteMany({ _id: { $in: [student?._id, otherStudent?._id].filter(Boolean) } }),
      User.deleteMany({ _id: { $in: [recoveryStudent?._id, lockedRecoveryStudent?._id].filter(Boolean) } }),
      User.deleteMany({ _id: registeredStudent?._id }),
    ])
    await mongoose.disconnect()
  }
})

test('student issue, ownership, return, inventory, and fine workflow', async (t) => {
  await t.test('rejects unauthenticated issue creation', async () => {
    const response = await request('/api/issues', {
      method: 'POST',
      body: { bookId: book._id.toString() },
    })

    assert.equal(response.status, 401)
  })

  await t.test('rejects unavailable books and frontend student IDs', async () => {
    const unavailable = await request('/api/issues', {
      method: 'POST',
      token: studentToken,
      body: { bookId: unavailableBook._id.toString() },
    })
    assert.equal(unavailable.status, 409)

    const injectedStudent = await request('/api/issues', {
      method: 'POST',
      token: studentToken,
      body: { bookId: book._id.toString(), studentId: otherStudent._id.toString() },
    })
    assert.equal(injectedStudent.status, 400)
  })

  await t.test('atomically limits concurrent issue requests to available stock', async () => {
    const responses = await Promise.all([
      request('/api/issues', {
        method: 'POST',
        token: studentToken,
        body: { bookId: raceBook._id.toString() },
      }),
      request('/api/issues', {
        method: 'POST',
        token: otherStudentToken,
        body: { bookId: raceBook._id.toString() },
      }),
    ])
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409])
    assert.equal(await Issue.countDocuments({ book: raceBook._id }), 1)
    assert.equal((await Book.findById(raceBook._id).lean()).availableCopies, 0)
  })

  let issueId
  await t.test('issues an available book and decrements its available copies', async () => {
    const response = await request('/api/issues', {
      method: 'POST',
      token: studentToken,
      body: { bookId: book._id.toString(), fine: 999 },
    })
    const result = await response.json()
    assert.equal(response.status, 201)
    assert.equal(result.issue.book._id, book._id.toString())
    assert.equal(result.issue.status, 'issued')
    assert.equal(result.issue.fine, 0)
    assert.ok(new Date(result.issue.dueDate) > new Date(result.issue.issueDate))
    issueId = result.issue.id

    const updatedBook = await Book.findById(book._id).lean()
    assert.equal(updatedBook.availableCopies, 1)
  })

  await t.test('rejects a duplicate active issue', async () => {
    const response = await request('/api/issues', {
      method: 'POST',
      token: studentToken,
      body: { bookId: book._id.toString() },
    })
    assert.equal(response.status, 409)
  })

  await t.test('limits issue list and detail access to the owning student', async () => {
    const otherList = await request('/api/issues/my', { token: otherStudentToken })
    const otherListBody = await otherList.json()
    assert.equal(otherList.status, 200)
    assert.ok(otherListBody.issues.every((issue) => issue.book._id === raceBook._id.toString()))
    assert.ok(otherListBody.issues.every((issue) => issue.id !== issueId))

    const otherDetail = await request(`/api/issues/${issueId}`, { token: otherStudentToken })
    assert.equal(otherDetail.status, 403)

    const ownDetail = await request(`/api/issues/${issueId}`, { token: studentToken })
    assert.equal(ownDetail.status, 200)

    const invalidDetail = await request('/api/issues/not-an-object-id', { token: studentToken })
    assert.equal(invalidDetail.status, 400)
  })

  await t.test('returns own book, restores availability, calculates late fine, and rejects a second return', async () => {
    const dueDate = new Date()
    dueDate.setUTCDate(dueDate.getUTCDate() - 2)
    await Issue.updateOne({ _id: issueId }, { $set: { dueDate } })

    const response = await request(`/api/issues/${issueId}/return`, {
      method: 'PUT',
      token: studentToken,
    })
    const result = await response.json()
    assert.equal(response.status, 200)
    assert.equal(result.issue.status, 'returned')
    assert.equal(result.issue.fine, 20)
    assert.ok(result.issue.returnDate)

    const updatedBook = await Book.findById(book._id).lean()
    assert.equal(updatedBook.availableCopies, 2)

    const secondReturn = await request(`/api/issues/${issueId}/return`, {
      method: 'PUT',
      token: studentToken,
    })
    assert.equal(secondReturn.status, 409)

    const returnedList = await request('/api/issues/my', { token: studentToken })
    const { issues } = await returnedList.json()
    assert.equal(issues[0].status, 'returned')
    assert.equal(issues[0].fine, 20)
  })

  await t.test('rejects returning another student’s issue', async () => {
    const activeIssueResponse = await request('/api/issues', {
      method: 'POST',
      token: studentToken,
      body: { bookId: book._id.toString() },
    })
    const activeIssue = await activeIssueResponse.json()
    const response = await request(`/api/issues/${activeIssue.issue.id}/return`, {
      method: 'PUT',
      token: otherStudentToken,
    })
    assert.equal(response.status, 403)
  })

  await t.test('returns dashboard data scoped to the authenticated student', async () => {
    const dashboardResponse = await request('/api/dashboard', { token: studentToken })
    const dashboard = await dashboardResponse.json()
    assert.equal(dashboardResponse.status, 200)
    assert.equal(dashboard.stats.currentlyIssued, await Issue.countDocuments({ student: student._id, status: 'issued' }))
    assert.equal(dashboard.stats.returnedBooks, 1)
    assert.equal(dashboard.issuedBooks.length, dashboard.stats.currentlyIssued)
    assert.ok(dashboard.issuedBooks.some((issue) => issue.title === 'Workflow Test Book'))

    const unauthenticated = await request('/api/dashboard')
    assert.equal(unauthenticated.status, 401)
  })

  await t.test('changes password only after authentication and current-password verification', async () => {
    const originalPassword = 'OriginalPass1!'
    student.password = await bcrypt.hash(originalPassword, 4)
    await student.save()

    const unauthenticated = await request('/api/auth/change-password', {
      method: 'PUT',
      body: { currentPassword: originalPassword, newPassword: 'ChangedPass2!' },
    })
    assert.equal(unauthenticated.status, 401)

    const wrongCurrent = await request('/api/auth/change-password', {
      method: 'PUT',
      token: studentToken,
      body: { currentPassword: 'WrongPass1!', newPassword: 'ChangedPass2!' },
    })
    assert.equal(wrongCurrent.status, 401)

    const weakPassword = await request('/api/auth/change-password', {
      method: 'PUT',
      token: studentToken,
      body: { currentPassword: originalPassword, newPassword: 'weak' },
    })
    assert.equal(weakPassword.status, 400)

    const changed = await request('/api/auth/change-password', {
      method: 'PUT',
      token: studentToken,
      body: { currentPassword: originalPassword, newPassword: 'ChangedPass2!' },
    })
    assert.equal(changed.status, 200)

    const storedUser = await User.findById(student._id).select('+password')
    assert.ok(await bcrypt.compare('ChangedPass2!', storedUser.password))
    assert.notEqual(storedUser.password, 'ChangedPass2!')
  })
})

test('Recovery PIN reset verifies ownership details, rate-limits attempts, and consumes reset tokens', async (t) => {
  await t.test('unknown account and incorrect PIN return the same generic response', async () => {
    const unknown = await request('/api/auth/recovery/verify', {
      method: 'POST',
      body: { registerNumber: 'TST9999999', recoveryPin: '123456' },
    })
    const incorrect = await request('/api/auth/recovery/verify', {
      method: 'POST',
      body: { registerNumber: recoveryStudent.registerNumber, recoveryPin: '999999' },
    })
    assert.equal(unknown.status, 401)
    assert.equal(incorrect.status, 401)
    assert.deepEqual(await unknown.json(), await incorrect.json())
  })

  await t.test('locks repeated incorrect recovery attempts', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request('/api/auth/recovery/verify', {
        method: 'POST',
        body: { registerNumber: lockedRecoveryStudent.registerNumber, recoveryPin: '000000' },
      })
      assert.equal(response.status, 401)
    }
    const locked = await User.findById(lockedRecoveryStudent._id).select('+recoveryLockedUntil').lean()
    assert.ok(locked.recoveryLockedUntil > new Date())
  })

  await t.test('returns a hashed PIN recovery capability, resets to bcrypt, and allows one use only', async () => {
    const userWithPin = await User.findById(recoveryStudent._id).select('+recoveryPinHash +password').lean()
    assert.notEqual(userWithPin.recoveryPinHash, '123456')
    assert.ok(await bcrypt.compare('123456', userWithPin.recoveryPinHash))

    const verified = await request('/api/auth/recovery/verify', {
      method: 'POST',
      body: { registerNumber: recoveryStudent.registerNumber, recoveryPin: '123456' },
    })
    const { resetToken } = await verified.json()
    assert.equal(verified.status, 200)
    assert.equal(typeof resetToken, 'string')

    const invalidPassword = await request('/api/auth/recovery/reset', {
      method: 'POST',
      body: { resetToken, newPassword: 'weak' },
    })
    assert.equal(invalidPassword.status, 400)

    const reset = await request('/api/auth/recovery/reset', {
      method: 'POST',
      body: { resetToken, newPassword: 'NewPassword2!' },
    })
    assert.equal(reset.status, 200)
    assert.match((await reset.json()).message, /Password reset successfully/)

    const stored = await User.findById(recoveryStudent._id)
      .select('+password +recoveryTokenHash +recoveryTokenExpiresAt')
      .lean()
    assert.ok(await bcrypt.compare('NewPassword2!', stored.password))
    assert.notEqual(stored.password, 'NewPassword2!')
    assert.equal(stored.recoveryTokenHash, undefined)
    assert.equal(stored.recoveryTokenExpiresAt, undefined)

    const replay = await request('/api/auth/recovery/reset', {
      method: 'POST',
      body: { resetToken, newPassword: 'OtherPassword3!' },
    })
    assert.equal(replay.status, 401)
  })
})

test('registration requires a confirmed Recovery PIN and stores only its bcrypt hash', async () => {
  const invalid = await request('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'New Recovery Student',
      registerNumber: 'TST0000005',
      phone: '1234567894',
      department: 'Computer Science',
      year: 'First year',
      password: 'StudentPass1!',
      recoveryPin: '12345',
    },
  })
  assert.equal(invalid.status, 400)

  const response = await request('/api/auth/register', {
    method: 'POST',
    body: {
      name: 'New Recovery Student',
      registerNumber: 'TST0000005',
      phone: '1234567894',
      department: 'Computer Science',
      year: 'First year',
      password: 'StudentPass1!',
      recoveryPin: '135790',
    },
  })
  assert.equal(response.status, 201)
  registeredStudent = await User.findOne({ registerNumber: 'TST0000005' })
    .select('+password +recoveryPinHash')
  assert.ok(await bcrypt.compare('135790', registeredStudent.recoveryPinHash))
  assert.notEqual(registeredStudent.recoveryPinHash, '135790')
  assert.ok(await bcrypt.compare('StudentPass1!', registeredStudent.password))
})

test('authenticated users can set a hashed Recovery PIN after current-password verification', async () => {
  const response = await request('/api/auth/recovery-pin', {
    method: 'PUT',
    token: studentToken,
    body: { currentPassword: 'ChangedPass2!', recoveryPin: '246810' },
  })
  assert.equal(response.status, 200)
  const stored = await User.findById(student._id).select('+recoveryPinHash').lean()
  assert.notEqual(stored.recoveryPinHash, '246810')
  assert.ok(await bcrypt.compare('246810', stored.recoveryPinHash))
})
