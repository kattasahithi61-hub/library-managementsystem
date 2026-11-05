import mongoose from 'mongoose'

const issueSchema = new mongoose.Schema({
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true,
    index: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  issueDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  dueDate: {
    type: Date,
    required: true,
  },
  returnDate: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['issued', 'returned', 'overdue'],
    required: true,
    default: 'issued',
  },
  fine: {
    type: Number,
    min: 0,
    default: 0,
  },
}, {
  timestamps: true,
  versionKey: false,
})

issueSchema.index(
  { student: 1, book: 1 },
  { unique: true, partialFilterExpression: { status: 'issued' } },
)
issueSchema.index({ student: 1, issueDate: -1 })

export default mongoose.model('Issue', issueSchema)
