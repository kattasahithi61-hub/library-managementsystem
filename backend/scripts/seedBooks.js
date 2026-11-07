import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { ensureDefaultBooks } from '../data/defaultBooks.js'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) })

async function seedBooks() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in backend/.env.')

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 5000,
  })
  const result = await ensureDefaultBooks()
  console.log(`Catalogue seed complete: ${result.added} added, ${result.existing} already present.`)
}

seedBooks()
  .catch((error) => {
    console.error('Catalogue seed failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
  })
