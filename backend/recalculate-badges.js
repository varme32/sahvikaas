import mongoose from 'mongoose'
import dotenv from 'dotenv'
import User from './models/User.js'
import { recalculateAllBadges, recalculateXP } from './services/badgeTrackingService.js'

dotenv.config({ path: './backend/.env' })

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/studyplatform'

async function recalculateAllUserBadges() {
  try {
    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(MONGO_URI)
    console.log('✅ Connected to MongoDB')

    const users = await User.find({}).select('_id name email')
    console.log(`\n📊 Found ${users.length} users`)

    let processed = 0
    let failed = 0

    for (const user of users) {
      try {
        console.log(`\n[${processed + 1}/${users.length}] Processing ${user.name} (${user.email})...`)
        await Promise.all([
          recalculateAllBadges(user._id),
          recalculateXP(user._id)
        ])
        processed++
        console.log(`✅ Successfully recalculated badges and XP for ${user.name}`)
      } catch (err) {
        failed++
        console.error(`❌ Failed to recalculate for ${user.name}:`, err.message)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('📈 Badge & XP Recalculation Summary')
    console.log('='.repeat(60))
    console.log(`Total users: ${users.length}`)
    console.log(`Successfully processed: ${processed}`)
    console.log(`Failed: ${failed}`)
    console.log('='.repeat(60))

    await mongoose.connection.close()
    console.log('\n✅ Database connection closed')
    process.exit(0)
  } catch (err) {
    console.error('❌ Fatal error:', err)
    process.exit(1)
  }
}

recalculateAllUserBadges()
