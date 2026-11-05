import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import User from '../models/User.js'

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) })

async function provisionAdmin() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('Admin provisioning is development-only. Set NODE_ENV=development explicitly.')
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required in backend/.env.')

  const prompt = createInterface({ input: stdin, output: stdout })
  try {
    const registerNumber = (await prompt.question('Existing student register number to promote: '))
      .trim()
      .toUpperCase()
    if (!/^[A-Z0-9]{10}$/.test(registerNumber)) {
      throw new Error('Enter a valid 10-character alphanumeric register number.')
    }

    const confirmation = await prompt.question(`Type PROMOTE ${registerNumber} to confirm: `)
    if (confirmation !== `PROMOTE ${registerNumber}`) {
      throw new Error('Confirmation did not match; no account was changed.')
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 5000,
    })
    const user = await User.findOneAndUpdate(
      { registerNumber },
      { $set: { role: 'admin' } },
      { returnDocument: 'after', runValidators: true, projection: '_id name registerNumber role' },
    ).lean()

    if (!user) throw new Error('No existing student account has that register number.')
    console.log(`Administrator role assigned to ${user.registerNumber} (${user.name}). Sign in again to refresh the JWT role.`)
  } finally {
    prompt.close()
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
  }
}

provisionAdmin().catch((error) => {
  console.error('Admin provisioning failed:', error.message)
  process.exitCode = 1
})
