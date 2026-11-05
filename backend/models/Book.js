import mongoose from 'mongoose'

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 240,
  },
  author: {
    type: String,
    required: true,
    trim: true,
    maxlength: 160,
  },
  isbn: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 32,
    unique: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100,
  },
  publisher: {
    type: String,
    trim: true,
    maxlength: 160,
    default: '',
  },
  description: {
    type: String,
    trim: true,
    maxlength: 5000,
    default: '',
  },
  totalCopies: {
    type: Number,
    required: true,
    min: 1,
    validate: {
      validator: Number.isInteger,
      message: 'Total copies must be a positive whole number.',
    },
  },
  availableCopies: {
    type: Number,
    required: true,
    min: 0,
    validate: [
      {
        validator: Number.isInteger,
        message: 'Available copies must be a whole number.',
      },
      {
        validator(value) {
          return value <= this.totalCopies
        },
        message: 'Available copies cannot exceed total copies.',
      },
    ],
  },
  coverImage: {
    type: String,
    trim: true,
    maxlength: 2048,
    default: '',
  },
}, {
  timestamps: true,
  versionKey: false,
})

export default mongoose.model('Book', bookSchema)
