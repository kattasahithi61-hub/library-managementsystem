import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })
process.env.JWT_SECRET = 'admin-students-test-secret-not-for-production'

const testUri = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/college_library_test'
const testDatabase = new URL(testUri).pathname.replace(/^\//, '')
if (!testDatabase.endsWith('_test')) {
  throw new Error('Tests require a MongoDB database name ending in _test.')
}

const [{ default: app }, { default: User }] = await Promise.all([
  import('../app.js'),
  import('../models/User.js'),
])

let server
let baseUrl
let admin
let student
let otherStudent
let adminToken
let studentToken

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

before(async () => {
  await mongoose.connect(testUri)
  await User.init()
  admin = await User.create({
    name: 'Student Management Admin',
    registerNumber: 'ADM0000001',
    phone: '1234567890',
    department: 'Computer Science',
    year: 'Fourth year',
    password: await bcrypt.hash('AdminPass1!', 4),
    role: 'admin',
  })
  student = await User.create({
    name: 'Student Management Student',
    registerNumber: 'STM0000001',
    phone: '1234567891',
    department: 'Science',
    year: 'Second year',
    password: await bcrypt.hash('StudentPass1!', 4),
    role: 'student',
  })
  otherStudent = await User.create({
    name: 'Student Management Other',
    registerNumber: 'STM0000002',
    phone: '1234567892',
    department: 'Business',
    year: 'First year',
    password: await bcrypt.hash('OtherPass1!', 4),
    role: 'student',
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
    await User.deleteMany({
      _id: { $in: [admin?._id, student?._id, otherStudent?._id].filter(Boolean) },
    })
    await mongoose.disconnect()
  }
})

test('admin student management is protected and updates account status safely', async (t) => {
  await t.test('rejects logged-out users and normal students from the student list', async () => {
    const loggedOut = await request('/api/admin/students')
    assert.equal(loggedOut.status, 401)

    const studentResponse = await request('/api/admin/students', { token: studentToken })
    assert.equal(studentResponse.status, 403)
  })

  await t.test('admin can list searchable student records without authentication fields', async () => {
    const response = await request('/api/admin/students?search=STM0000001', { token: adminToken })
    const result = await response.json()
    assert.equal(response.status, 200)
    assert.equal(result.students.length, 1)
    assert.equal(result.students[0].id, student._id.toString())
    assert.equal(result.students[0].registerNumber, 'STM0000001')
    assert.equal(result.students[0].active, true)
    assert.equal(result.students[0].activeIssuesCount, 0)
    for (const sensitiveField of ['password', 'recoveryPinHash', 'recoveryAttempts', 'recoveryTokenHash']) {
      assert.equal(sensitiveField in result.students[0], false)
    }

    const unfiltered = await request('/api/admin/students', { token: adminToken })
    const listedIds = (await unfiltered.json()).students.map(({ id }) => id)
    assert.ok(listedIds.includes(student._id.toString()))
    assert.ok(listedIds.includes(otherStudent._id.toString()))
  })

  await t.test('admin can view a student and issue summary', async () => {
    const response = await request(`/api/admin/students/${student._id}`, { token: adminToken })
    const result = await response.json()
    assert.equal(response.status, 200)
    assert.equal(result.student.id, student._id.toString())
    assert.deepEqual(result.summary, {
      totalBooksIssued: 0,
      currentlyIssued: 0,
      returnedBooks: 0,
      overdueBooks: 0,
      totalFines: 0,
    })
    assert.equal('password' in result.student, false)

    const invalidId = await request('/api/admin/students/not-an-id', { token: adminToken })
    assert.equal(invalidId.status, 400)
  })

  await t.test('student cannot use admin status API to change any account', async () => {
    const response = await request(`/api/admin/students/${otherStudent._id}/status`, {
      method: 'PUT',
      token: studentToken,
      body: { active: false },
    })
    assert.equal(response.status, 403)
    assert.equal((await User.findById(otherStudent._id).lean()).active, true)
  })

  await t.test('admin can deactivate and reactivate a student without changing protected fields', async () => {
    const originalHash = (await User.findById(student._id).select('+password').lean()).password
    const deactivated = await request(`/api/admin/students/${student._id}/status`, {
      method: 'PUT',
      token: adminToken,
      body: { active: false },
    })
    const deactivatedResult = await deactivated.json()
    assert.equal(deactivated.status, 200)
    assert.equal(deactivatedResult.student.active, false)
    assert.equal(deactivatedResult.student.role, undefined)
    assert.equal((await User.findById(student._id).select('+password').lean()).password, originalHash)

    const protectedRequest = await request('/api/issues/my', { token: studentToken })
    assert.equal(protectedRequest.status, 403)

    const login = await request('/api/auth/login', {
      method: 'POST',
      body: { registerNumber: student.registerNumber, password: 'StudentPass1!' },
    })
    assert.equal(login.status, 403)

    const invalidBody = await request(`/api/admin/students/${student._id}/status`, {
      method: 'PUT',
      token: adminToken,
      body: { active: true, role: 'admin' },
    })
    assert.equal(invalidBody.status, 400)

    const reactivated = await request(`/api/admin/students/${student._id}/status`, {
      method: 'PUT',
      token: adminToken,
      body: { active: true },
    })
    assert.equal(reactivated.status, 200)
    assert.equal((await User.findById(student._id).lean()).active, true)
  })

  await t.test('existing authentication still accepts an active student login', async () => {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: { registerNumber: student.registerNumber, password: 'StudentPass1!' },
    })
    const result = await response.json()
    assert.equal(response.status, 200)
    assert.equal(result.user.registerNumber, student.registerNumber)
    assert.equal(result.user.active, true)
    assert.equal('password' in result.user, false)
  })
})
