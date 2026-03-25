/**
 * Make Admin Script
 * Usage: node make-admin.js <email>
 * 
 * This sets a user's role to 'admin' by their email address.
 * Run this once to create your first admin user.
 */

import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { connectDB } from './db.js'
import User from './models/User.js'

dotenv.config()

const email = process.argv[2]

if (!email) {
  console.error('❌ Usage: node make-admin.js <email>')
  process.exit(1)
}

async function run() {
  await connectDB()
  
  const user = await User.findOne({ email: email.toLowerCase().trim() })
  if (!user) {
    console.error(`❌ No user found with email: ${email}`)
    process.exit(1)
  }
  
  user.role = 'admin'
  await user.save()
  
  console.log(`✅ ${user.name} (${user.email}) is now an admin!`)
  process.exit(0)
}

run().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})
