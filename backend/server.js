import mongoose from 'mongoose'
import app from './app.js'
import Book from './models/Book.js'
import Issue from './models/Issue.js'
import User from './models/User.js'
const port = Number(process.env.PORT) || 5055

async function startServer() {
  const mongoUri = process.env.MONGODB_URI
  if (!mongoUri) throw new Error('MONGODB_URI is required in backend/.env.')
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a randomly generated secret with at least 32 characters.')
  }

  const server = app.listen(port, () => {
    console.log(`Library API listening on http://localhost:${port}`)
  })

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 5000,
    })
    await User.init()
    await Book.init()
    await Issue.init()
    console.log('MongoDB connected and model indexes are ready.')
  } catch (error) {
    console.error('MongoDB connection failed; the API is running in degraded mode.', error)
  }

  return server
}

startServer().catch((error) => {
  console.error('Could not start the library API.', error)
  process.exitCode = 1
})
