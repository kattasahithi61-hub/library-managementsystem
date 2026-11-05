import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import jwt from 'jsonwebtoken'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true })
process.env.JWT_SECRET = 'profile-workflow-test-secret-not-for-production'

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
let student
let otherStudent
let studentToken
let otherStudentToken

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
  student = await User.create({
    name: 'Profile Test Student',
    registerNumber: 'PRF0000001',
    phone: '1234567890',
    department: 'Computer Science',
    year: 'First year',
    password: 'stored-password-hash',
    role: 'student',
  })
  otherStudent = await User.create({
    name: 'Profile Other Student',
    registerNumber: 'PRF0000002',
    phone: '1234567891',
    department: 'Science',
    year: 'Second year',
    password: 'other-stored-password-hash',
    role: 'student',
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
    await User.deleteMany({ _id: { $in: [student?._id, otherStudent?._id].filter(Boolean) } })
    await mongoose.disconnect()
  }
})

test('authenticated profile reads and updates stay scoped to the JWT user', async (t) => {
  await t.test('requires authentication and returns only safe current-user profile fields', async () => {
    const unauthenticated = await request('/api/auth/me')
    assert.equal(unauthenticated.status, 401)

    const response = await request('/api/auth/me', { token: studentToken })
    const result = await response.json()
    assert.equal(response.status, 200)
    assert.equal(result.user.id, student._id.toString())
    assert.equal(result.user.name, student.name)
    assert.equal(result.user.phone, student.phone)
    assert.equal(result.user.department, student.department)
    assert.equal(result.user.year, student.year)
    assert.equal(result.user.role, 'student')
    assert.ok(result.user.createdAt)
    assert.equal('password' in result.user, false)
    assert.equal('recoveryPinHash' in result.user, false)
  })

  await t.test('updates allowed fields but rejects role and unknown fields', async () => {
    const response = await request('/api/auth/me', {
      method: 'PUT',
      token: studentToken,
      body: {
        name: '  Updated Profile Student  ',
        phone: '+1 (415) 555-0101',
        department: 'Engineering',
        year: 'Third year',
      },
    })
    const result = await response.json()
    assert.equal(response.status, 200)
    assert.equal(result.user.name, 'Updated Profile Student')
    assert.equal(result.user.phone, '+1 (415) 555-0101')
    assert.equal(result.user.department, 'Engineering')
    assert.equal(result.user.year, 'Third year')
    assert.equal(result.user.role, 'student')
    assert.equal('password' in result.user, false)

    const storedStudent = await User.findById(student._id).select('+password').lean()
    assert.equal(storedStudent.name, 'Updated Profile Student')
    assert.equal(storedStudent.role, 'student')
    assert.equal(storedStudent.password, 'stored-password-hash')

    const forbiddenUpdate = await request('/api/auth/me', {
      method: 'PUT',
      token: studentToken,
      body: { role: 'admin' },
    })
    assert.equal(forbiddenUpdate.status, 400)
    assert.equal((await User.findById(student._id).lean()).role, 'student')
  })

  await t.test('validates provided fields and does not permit targeting another user', async () => {
    const invalid = await request('/api/auth/me', {
      method: 'PUT',
      token: studentToken,
      body: { phone: 'x', department: 'Unknown' },
    })
    const invalidResult = await invalid.json()
    assert.equal(invalid.status, 400)
    assert.ok(invalidResult.errors.phone)
    assert.ok(invalidResult.errors.department)

    const targeted = await request('/api/auth/me', {
      method: 'PUT',
      token: studentToken,
      body: { userId: otherStudent._id.toString(), name: 'Changed Other Student' },
    })
    assert.equal(targeted.status, 400)
    assert.equal((await User.findById(otherStudent._id).lean()).name, 'Profile Other Student')

    const otherResponse = await request('/api/auth/me', { token: otherStudentToken })
    const otherResult = await otherResponse.json()
    assert.equal(otherResult.user.id, otherStudent._id.toString())
    assert.equal(otherResult.user.name, 'Profile Other Student')
  })
})
