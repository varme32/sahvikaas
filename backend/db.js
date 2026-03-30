import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

// Support both MONGO_URI and MONGODB_URI for compatibility
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/studyhub'

export async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    console.log('✅ MongoDB connected successfully')
    console.log(`📊 Database: ${mongoose.connection.name}`)
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message)
    console.error('⚠️  Server will continue without DB. Auth/data routes will fail.')
    console.error('💡 Check your MONGO_URI in .env file')
  }
}

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected')
})

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err.message)
})

export default mongoose
