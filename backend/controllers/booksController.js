import mongoose from 'mongoose'
import Book from '../models/Book.js'

const searchableFields = ['title', 'author', 'isbn', 'category']
const writableFields = [
  'title',
  'author',
  'isbn',
  'category',
  'publisher',
  'description',
  'totalCopies',
  'availableCopies',
  'coverImage',
]
const numericFields = new Set(['totalCopies', 'availableCopies'])

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function validateCoverImage(value) {
  if (!value) return true
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

function getBookInput(body, { partial = false } = {}) {
  const errors = {}
  const input = {}

  for (const field of writableFields) {
    if (!Object.hasOwn(body, field)) continue
    const value = body[field]

    if (numericFields.has(field)) {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors[field] = 'Enter a whole number.'
      } else {
        input[field] = value
      }
      continue
    }

    if (typeof value !== 'string') {
      errors[field] = 'Enter a valid text value.'
      continue
    }
    input[field] = field === 'isbn'
      ? value.trim().replace(/[\s-]/g, '').toUpperCase()
      : value.trim()
  }

  for (const field of ['title', 'author', 'isbn', 'category']) {
    if (!partial || Object.hasOwn(input, field)) {
      if (typeof input[field] !== 'string' || !input[field]) {
        errors[field] = `${field[0].toUpperCase()}${field.slice(1)} is required.`
      }
    }
  }

  const resultingTotal = input.totalCopies
  const resultingAvailable = input.availableCopies
  if (resultingTotal !== undefined && resultingTotal < 1) {
    errors.totalCopies = 'Total copies must be a positive whole number.'
  }
  if (resultingAvailable !== undefined && resultingAvailable < 0) {
    errors.availableCopies = 'Available copies cannot be negative.'
  }
  if (!validateCoverImage(input.coverImage)) {
    errors.coverImage = 'Cover image must be an HTTP(S) URL or a local path.'
  }

  return { errors, input }
}

function respondValidationError(res, errors) {
  return res.status(400).json({ message: 'Please correct the book fields.', errors })
}

function respondDatabaseError(res, error) {
  if (error?.code === 11000 && error.keyPattern?.isbn) {
    return res.status(409).json({ message: 'A book with this ISBN already exists.' })
  }
  if (error?.name === 'ValidationError' || error?.name === 'CastError') {
    const errors = error.name === 'ValidationError'
      ? Object.fromEntries(Object.entries(error.errors).map(([field, issue]) => [field, issue.message]))
      : { [error.path]: 'Enter a valid value.' }
    return respondValidationError(res, errors)
  }
  console.error('Books API database operation failed.', error)
  return res.status(500).json({ message: 'The book request could not be completed.' })
}

export async function listBooks(req, res) {
  const search = typeof req.query.search === 'string'
    ? req.query.search.trim()
    : typeof req.query.q === 'string'
      ? req.query.q.trim()
      : ''
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : ''
  const query = {}

  if (search) {
    const expression = new RegExp(escapeRegex(search), 'i')
    query.$or = searchableFields.map((field) => ({ [field]: expression }))
  }
  if (category && category.toLocaleLowerCase() !== 'all books') {
    query.category = new RegExp(`^${escapeRegex(category)}$`, 'i')
  }

  try {
    const books = await Book.find(query).sort({ title: 1, _id: 1 }).lean()
    return res.status(200).json({ books })
  } catch (error) {
    console.error('Unable to retrieve books.', error)
    return res.status(500).json({ message: 'Books could not be retrieved.' })
  }
}

export async function getBook(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid book ID.' })
  }

  try {
    const book = await Book.findById(req.params.id).lean()
    if (!book) return res.status(404).json({ message: 'Book not found.' })
    return res.status(200).json({ book })
  } catch (error) {
    return respondDatabaseError(res, error)
  }
}

export async function createBook(req, res) {
  const { errors, input } = getBookInput(req.body ?? {})
  if (input.totalCopies === undefined) errors.totalCopies = 'Total copies must be a positive whole number.'
  if (input.availableCopies === undefined && input.totalCopies !== undefined && input.totalCopies > 0) {
    input.availableCopies = input.totalCopies
  }
  if (Object.keys(errors).length > 0) return respondValidationError(res, errors)

  if (input.availableCopies > input.totalCopies) {
    return respondValidationError(res, { availableCopies: 'Available copies cannot exceed total copies.' })
  }

  try {
    const book = await Book.create(input)
    return res.status(201).json({ message: 'Book created successfully.', book })
  } catch (error) {
    return respondDatabaseError(res, error)
  }
}

export async function updateBook(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid book ID.' })
  }

  const { errors, input } = getBookInput(req.body ?? {}, { partial: true })
  if (Object.keys(errors).length > 0) return respondValidationError(res, errors)
  if (Object.keys(input).length === 0) {
    return res.status(400).json({ message: 'Provide at least one valid book field to update.' })
  }

  try {
    const book = await Book.findById(req.params.id)
    if (!book) return res.status(404).json({ message: 'Book not found.' })
    Object.assign(book, input)

    const resultingTotal = input.totalCopies ?? book.totalCopies
    const resultingAvailable = input.availableCopies ?? book.availableCopies
    if (resultingTotal < 1) {
      return respondValidationError(res, { totalCopies: 'Total copies must be a positive whole number.' })
    }
    if (resultingAvailable < 0) {
      return respondValidationError(res, { availableCopies: 'Available copies cannot be negative.' })
    }
    if (resultingAvailable > resultingTotal) {
      return respondValidationError(res, { availableCopies: 'Available copies cannot exceed total copies.' })
    }

    await book.save()
    return res.status(200).json({ message: 'Book updated successfully.', book })
  } catch (error) {
    return respondDatabaseError(res, error)
  }
}

export async function deleteBook(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: 'Invalid book ID.' })
  }

  try {
    const book = await Book.findByIdAndDelete(req.params.id)
    if (!book) return res.status(404).json({ message: 'Book not found.' })
    return res.status(200).json({ message: 'Book deleted successfully.', id: book.id })
  } catch (error) {
    return respondDatabaseError(res, error)
  }
}
