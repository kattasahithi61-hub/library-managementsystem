import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import cookieParser from 'cookie-parser'
import mongoose from 'mongoose'
import { fileURLToPath } from 'node:url'
import authRoutes from './routes/authRoutes.js'
import bookRoutes from './routes/bookRoutes.js'
import adminBookRoutes from './routes/adminBookRoutes.js'
import issueRoutes from './routes/issueRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'

dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)) })

const app = express()
const configuredOrigins = [process.env.CLIENT_ORIGINS, process.env.CLIENT_ORIGIN]
  .filter(Boolean)
  .flatMap((origins) => origins.split(',').map((origin) => origin.trim()).filter(Boolean))
const allowedOrigins = new Set([
  'https://library-managementsystem-zeta.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4175',
  'http://127.0.0.1:4175',
  ...configuredOrigins,
])

app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true)
    return callback(new Error('Origin is not allowed by the library API CORS policy.'))
  },
}))
app.use(express.json({ limit: '10kb' }))
app.use(cookieParser())

app.get('/api/health', (_req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting']
  const mongoStatus = states[mongoose.connection.readyState] || 'unknown'
  const isMongoConnected = mongoose.connection.readyState === 1

  res.status(isMongoConnected ? 200 : 503).json({
    status: isMongoConnected ? 'ok' : 'degraded',
    backend: 'running',
    mongodb: {
      status: mongoStatus,
      readyState: mongoose.connection.readyState,
    },
  })
})
app.use('/api/auth', authRoutes)
app.use('/api/admin', adminBookRoutes)
app.use('/api/books', bookRoutes)
app.use('/api/issues', issueRoutes)
app.use('/api/dashboard', dashboardRoutes)

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({ message: 'Request body must be valid JSON.' })
  }
  if (error.message?.includes('CORS policy')) {
    return res.status(403).json({ message: 'This origin is not allowed to access the library API.' })
  }
  console.error('Unhandled API error.', error)
  return res.status(500).json({ message: 'An unexpected server error occurred.' })
})

export default app
