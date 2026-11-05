import mongoose from 'mongoose'

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120,
  },
  registerNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    match: /^[A-Z0-9]{10}$/,
    unique: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
    maxlength: 20,
  },
  department: {
    type: String,
    required: true,
    enum: ['Computer Science', 'Engineering', 'Business', 'Arts and Humanities', 'Science', 'Other'],
  },
  year: {
    type: String,
    required: true,
    enum: ['First year', 'Second year', 'Third year', 'Fourth year', 'Postgraduate'],
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student',
  },
  active: {
    type: Boolean,
    default: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  recoveryPinHash: {
    type: String,
    select: false,
  },
  recoveryAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  recoveryLockedUntil: {
    type: Date,
    default: null,
    select: false,
  },
  recoveryTokenHash: {
    type: String,
    default: null,
    select: false,
  },
  recoveryTokenExpiresAt: {
    type: Date,
    default: null,
    select: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
})

export default mongoose.model('User', userSchema)
