import bcrypt from 'bcrypt'
import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const registerNumberPattern = /^[A-Za-z0-9]{10}$/
const profilePhonePattern = /^[+()\d\s-]{7,20}$/
const passwordRules = [
  /[A-Z]/,
  /[a-z]/,
  /\d/,
  /[^A-Za-z0-9\s]/,
]
const recoveryPinPattern = /^\d{6}$/
const recoveryAttemptLimit = 5
const recoveryLockDurationMs = 15 * 60 * 1000
const recoveryTokenDurationMs = 10 * 60 * 1000
const dummyRecoveryPinHash = bcrypt.hash(randomBytes(32).toString('hex'), 12)
const genericRecoveryFailure = 'Unable to verify these recovery details. Check the register number and Recovery PIN, then try again.'

function hashRecoveryToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

function isRecoveryPinValid(pin) {
  return typeof pin === 'string' && recoveryPinPattern.test(pin)
}

function isPasswordValid(password) {
  return typeof password === 'string'
    && password.length >= 8
    && passwordRules.every((rule) => rule.test(password))
}

function getAuthCookieName() {
  return process.env.AUTH_COOKIE_NAME || 'library_auth'
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '1h'
}

function getJwtMaxAge() {
  const expiration = /^(\d+)(ms|s|m|h|d)$/.exec(getJwtExpiresIn())
  if (!expiration) return 60 * 60 * 1000
  const unitsInMs = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  return Number(expiration[1]) * unitsInMs[expiration[2]]
}

function getSafeUser(user) {
  return {
    id: user.id || user._id.toString(),
    name: user.name,
    registerNumber: user.registerNumber,
    phone: user.phone,
    department: user.department,
    year: user.year,
    role: user.role || 'student',
    active: user.active !== false,
    createdAt: user.createdAt,
  }
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
    maxAge: 60 * 60 * 1000,
  }
}

export async function login(req, res) {
  const registerNumber = typeof req.body?.registerNumber === 'string'
    ? req.body.registerNumber.trim().toUpperCase()
    : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!registerNumber || !password) {
    return res.status(400).json({ message: 'Register number and password are required.' })
  }
  if (!registerNumberPattern.test(registerNumber)) {
    return res.status(400).json({
      message: 'Register number must be exactly 10 characters using letters and numbers only.',
    })
  }

  try {
    const user = await User.findOne({ registerNumber }).select('+password')
    if (!user) return res.status(404).json({ message: 'No account found for this register number.' })
    if (user.active === false) {
      return res.status(403).json({ message: 'This account is inactive. Contact the library administrator.' })
    }

    const passwordMatches = await bcrypt.compare(password, user.password)
    if (!passwordMatches) return res.status(401).json({ message: 'Incorrect password.' })

    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) {
      console.error('JWT_SECRET is not configured.')
      return res.status(500).json({ message: 'Authentication is not configured. Please contact the library administrator.' })
    }

    const safeUser = getSafeUser(user)
    const token = jwt.sign(
      { role: safeUser.role },
      jwtSecret,
      { subject: safeUser.id, expiresIn: getJwtExpiresIn() },
    )

    res.cookie(getAuthCookieName(), token, {
      ...getCookieOptions(),
      maxAge: getJwtMaxAge(),
    })
    return res.status(200).json({ message: 'Login successful.', token, user: safeUser })
  } catch (error) {
    console.error('Unable to log in student.', error)
    return res.status(500).json({ message: 'Login could not be completed. Please try again.' })
  }
}

export async function getCurrentUser(req, res) {
  try {
    const user = await User.findById(req.authenticatedUser._id)
      .select('_id name registerNumber phone department year role active createdAt')
      .lean()
    if (!user) return res.status(401).json({ message: 'Your account is no longer available. Please sign in again.' })
    return res.status(200).json({ user: getSafeUser(user) })
  } catch (error) {
    console.error('Unable to restore authenticated student session.', error)
    return res.status(500).json({ message: 'Your session could not be verified. Please try again.' })
  }
}

const profileFields = new Set(['name', 'phone', 'department', 'year'])
const phonePattern = /^[+()\d\s-]{7,20}$/

export async function updateCurrentUser(req, res) {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ message: 'Profile details must be sent as a JSON object.' })
  }

  const unknownFields = Object.keys(body).filter((field) => !profileFields.has(field))
  if (unknownFields.length > 0) {
    return res.status(400).json({
      message: 'The profile contains fields that cannot be changed.',
      errors: Object.fromEntries(unknownFields.map((field) => [field, 'This field cannot be changed.'])),
    })
  }

  const errors = {}
  const profile = {}
  for (const field of profileFields) {
    if (!Object.hasOwn(body, field)) continue
    if (typeof body[field] !== 'string') {
      errors[field] = 'This field must be a string.'
      continue
    }
    profile[field] = body[field].trim()
  }

  if (profile.name !== undefined && (!profile.name || profile.name.length > 120)) {
    errors.name = 'Enter a name between 1 and 120 characters.'
  }
  if (profile.phone !== undefined && !profilePhonePattern.test(profile.phone)) {
    errors.phone = 'Enter a valid phone number.'
  }
  if (
    profile.department !== undefined
    && !User.schema.path('department').enumValues.includes(profile.department)
  ) {
    errors.department = 'Select a valid department.'
  }
  if (profile.year !== undefined && !User.schema.path('year').enumValues.includes(profile.year)) {
    errors.year = 'Select a valid year of study.'
  }
  if (Object.keys(profile).length === 0) {
    errors.profile = 'Provide at least one profile field to update.'
  }
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Please correct the highlighted fields.', errors })
  }

  try {
    const user = await User.findById(req.authenticatedUser._id)
    if (!user) return res.status(404).json({ message: 'Your account is no longer available.' })

    Object.assign(user, profile)
    await user.save()
    return res.status(200).json({
      message: 'Profile updated successfully.',
      user: getSafeUser(user),
    })
  } catch (error) {
    if (error?.name === 'ValidationError') {
      const validationErrors = Object.fromEntries(
        Object.entries(error.errors).map(([field, issue]) => [field, issue.message]),
      )
      return res.status(400).json({ message: 'Please correct the highlighted fields.', errors: validationErrors })
    }
    console.error('Unable to update authenticated student profile.', error)
    return res.status(500).json({ message: 'Profile could not be updated. Please try again.' })
  }
}

export function logout(_req, res) {
  res.clearCookie(getAuthCookieName(), getCookieOptions())
  return res.status(200).json({ message: 'Logged out successfully.' })
}

export async function changePassword(req, res) {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
  const passwordIsValid = newPassword.length >= 8 && passwordRules.every((rule) => rule.test(newPassword))

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required.' })
  }
  if (!passwordIsValid) {
    return res.status(400).json({
      message: 'New password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
    })
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'Choose a new password different from your current password.' })
  }

  try {
    const user = await User.findById(req.authenticatedUser._id).select('+password')
    if (!user) return res.status(401).json({ message: 'Your account is no longer available. Please sign in again.' })

    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.password)
    if (!currentPasswordMatches) return res.status(401).json({ message: 'Current password is incorrect.' })

    user.password = await bcrypt.hash(newPassword, 12)
    await user.save()
    return res.status(200).json({ message: 'Password changed successfully.' })
  } catch (error) {
    console.error('Unable to change account password.', error)
    return res.status(500).json({ message: 'Password could not be changed. Please try again.' })
  }
}

export async function verifyRecoveryDetails(req, res) {
  const registerNumber = typeof req.body?.registerNumber === 'string'
    ? req.body.registerNumber.trim().toUpperCase()
    : ''
  const recoveryPin = typeof req.body?.recoveryPin === 'string' ? req.body.recoveryPin : ''

  if (!registerNumberPattern.test(registerNumber) || !isRecoveryPinValid(recoveryPin)) {
    return res.status(400).json({ message: 'Enter a valid register number and 6-digit Recovery PIN.' })
  }

  try {
    const user = await User.findOne({ registerNumber })
      .select('+recoveryPinHash +recoveryAttempts +recoveryLockedUntil')
    if (!user) {
      await bcrypt.compare(recoveryPin, await dummyRecoveryPinHash)
      return res.status(401).json({ message: genericRecoveryFailure })
    }

    const isLocked = user.recoveryLockedUntil && user.recoveryLockedUntil > new Date()
    if (isLocked) {
      await bcrypt.compare(recoveryPin, user.recoveryPinHash || await dummyRecoveryPinHash)
      return res.status(401).json({ message: genericRecoveryFailure })
    }

    const pinMatches = user.recoveryPinHash
      ? await bcrypt.compare(recoveryPin, user.recoveryPinHash)
      : await bcrypt.compare(recoveryPin, await dummyRecoveryPinHash)

    if (!pinMatches || !user.recoveryPinHash) {
      if (user.recoveryPinHash) {
        await User.updateOne(
          { _id: user._id, $or: [{ recoveryLockedUntil: null }, { recoveryLockedUntil: { $lte: new Date() } }] },
          { $inc: { recoveryAttempts: 1 } },
        )
        const updated = await User.findById(user._id).select('+recoveryAttempts').lean()
        if (updated?.recoveryAttempts >= recoveryAttemptLimit) {
          await User.updateOne(
            { _id: user._id },
            { $set: { recoveryLockedUntil: new Date(Date.now() + recoveryLockDurationMs), recoveryAttempts: 0 } },
          )
        }
      }
      return res.status(401).json({ message: genericRecoveryFailure })
    }

    const resetToken = randomBytes(32).toString('base64url')
    const now = new Date()
    const updatedUser = await User.updateOne(
      {
        _id: user._id,
        recoveryPinHash: user.recoveryPinHash,
        $or: [{ recoveryLockedUntil: null }, { recoveryLockedUntil: { $lte: now } }],
      },
      {
        $set: {
          recoveryAttempts: 0,
          recoveryTokenHash: hashRecoveryToken(resetToken),
          recoveryTokenExpiresAt: new Date(now.getTime() + recoveryTokenDurationMs),
        },
        $unset: { recoveryLockedUntil: 1 },
      },
    )
    if (updatedUser.modifiedCount !== 1) {
      return res.status(401).json({ message: genericRecoveryFailure })
    }

    return res.status(200).json({ resetToken })
  } catch (error) {
    console.error('Unable to verify password recovery details.', error)
    return res.status(500).json({ message: 'Recovery could not be completed. Please try again.' })
  }
}

export async function resetPassword(req, res) {
  const resetToken = typeof req.body?.resetToken === 'string' ? req.body.resetToken : ''
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
  if (!resetToken || resetToken.length > 128) {
    return res.status(400).json({ message: 'Verify your Recovery PIN before resetting the password.' })
  }
  if (!isPasswordValid(newPassword)) {
    return res.status(400).json({
      message: 'New password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.',
    })
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 12)
    const now = new Date()
    const updated = await User.updateOne(
      {
        recoveryTokenHash: hashRecoveryToken(resetToken),
        recoveryTokenExpiresAt: { $gt: now },
      },
      {
        $set: { password: passwordHash },
        $unset: { recoveryTokenHash: 1, recoveryTokenExpiresAt: 1, recoveryLockedUntil: 1 },
      },
    )
    if (updated.modifiedCount !== 1) {
      return res.status(401).json({ message: 'This recovery session has expired or was already used. Verify your Recovery PIN again.' })
    }
    return res.status(200).json({ message: 'Password reset successfully. Please login with your new password.' })
  } catch (error) {
    console.error('Unable to reset account password.', error)
    return res.status(500).json({ message: 'Password could not be reset. Please try again.' })
  }
}

export async function setRecoveryPin(req, res) {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
  const recoveryPin = typeof req.body?.recoveryPin === 'string' ? req.body.recoveryPin : ''
  if (!currentPassword || !isRecoveryPinValid(recoveryPin)) {
    return res.status(400).json({ message: 'Enter your current password and a 6-digit Recovery PIN.' })
  }

  try {
    const user = await User.findById(req.authenticatedUser._id).select('+password')
    if (!user) return res.status(401).json({ message: 'Your account is no longer available. Please sign in again.' })
    if (!await bcrypt.compare(currentPassword, user.password)) {
      return res.status(401).json({ message: 'Current password is incorrect.' })
    }

    user.recoveryPinHash = await bcrypt.hash(recoveryPin, 12)
    user.recoveryAttempts = 0
    user.recoveryLockedUntil = null
    user.recoveryTokenHash = null
    user.recoveryTokenExpiresAt = null
    await user.save()
    return res.status(200).json({ message: 'Recovery PIN saved securely.' })
  } catch (error) {
    console.error('Unable to save Recovery PIN.', error)
    return res.status(500).json({ message: 'Recovery PIN could not be saved. Please try again.' })
  }
}

function validateRegistration(body) {
  const errors = {}
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const registerNumber = typeof body.registerNumber === 'string' ? body.registerNumber.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const recoveryPin = typeof body.recoveryPin === 'string' ? body.recoveryPin : ''
  const { department, year, password } = body

  if (!name || name.length > 120) errors.studentName = 'Enter a name between 1 and 120 characters.'
  if (!registerNumberPattern.test(registerNumber)) {
    errors.registerNumber = 'Register number must be exactly 10 characters using letters and numbers only.'
  }
  if (!phonePattern.test(phone)) errors.phone = 'Enter a valid phone number.'
  if (!User.schema.path('department').enumValues.includes(department)) errors.department = 'Select a valid department.'
  if (!User.schema.path('year').enumValues.includes(year)) errors.year = 'Select a valid year of study.'
  if (typeof password !== 'string' || password.length < 8 || !passwordRules.every((rule) => rule.test(password))) {
    errors.password = 'Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.'
  }
  if (!isRecoveryPinValid(recoveryPin)) errors.recoveryPin = 'Recovery PIN must be exactly 6 digits.'

  return {
    errors,
    student: {
      name,
      registerNumber: registerNumber.toUpperCase(),
      phone,
      department,
      year,
      password,
      recoveryPin,
    },
  }
}

export async function register(req, res) {
  const { errors, student } = validateRegistration(req.body ?? {})
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ message: 'Please correct the highlighted fields.', errors })
  }

  try {
    const existingUser = await User.findOne({ registerNumber: student.registerNumber }).select('_id').lean()
    if (existingUser) {
      return res.status(409).json({ message: 'Register Number already registered.' })
    }

    const hashedPassword = await bcrypt.hash(student.password, 12)
    const recoveryPinHash = await bcrypt.hash(student.recoveryPin, 12)
    const user = await User.create({
      name: student.name,
      registerNumber: student.registerNumber,
      phone: student.phone,
      department: student.department,
      year: student.year,
      password: hashedPassword,
      recoveryPinHash,
    })

    return res.status(201).json({
      message: 'Registration successful.',
      user: {
        id: user.id,
        name: user.name,
        registerNumber: user.registerNumber,
      },
    })
  } catch (error) {
    if (error?.code === 11000 && error.keyPattern?.registerNumber) {
      return res.status(409).json({ message: 'Register Number already registered.' })
    }

    if (error?.name === 'ValidationError') {
      const validationErrors = Object.fromEntries(
        Object.entries(error.errors).map(([field, issue]) => [field, issue.message]),
      )
      console.warn('Student registration rejected by model validation.', validationErrors)
      return res.status(400).json({ message: 'Please correct the highlighted fields.', errors: validationErrors })
    }

    console.error('Unable to register student.', error)
    return res.status(500).json({ message: 'Registration could not be completed. Please try again.' })
  }
}
