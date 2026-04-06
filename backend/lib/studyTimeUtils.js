import StudyActivity from '../models/StudyActivity.js'
import Room from '../models/Room.js'

/**
 * Calculate total study hours for a user from all sources
 * Returns the maximum value from:
 * 1. User.totalStudyHours (profile field)
 * 2. Sum of StudyActivity hours
 * 3. Sum of completed room durations
 * 
 * @param {ObjectId} userId - The user's ID
 * @param {Object} user - Optional user document (to avoid extra query)
 * @returns {Promise<number>} Total study hours (rounded to 2 decimal places)
 */
export async function calculateTotalStudyHours(userId, user = null) {
  try {
    // Source 1: User profile field
    const fromProfile = user ? (Number(user.totalStudyHours) || 0) : 0

    // Source 2: Sum of StudyActivity hours
    const activityAgg = await StudyActivity.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: '$hours' } } }
    ])
    const fromActivity = activityAgg[0]?.total || 0

    // Source 3: Sum of completed room durations (convert minutes to hours)
    const completedRooms = await Room.find({
      participants: userId,
      status: 'completed'
    }).select('duration createdAt endedAt').lean()

    let fromRooms = 0
    for (const room of completedRooms) {
      const storedMinutes = Math.max(0, Number(room.duration) || 0)
      const derivedMinutes = room.endedAt && room.createdAt
        ? Math.max(0, Math.round((new Date(room.endedAt) - new Date(room.createdAt)) / 60000))
        : 0
      const minutes = Math.max(storedMinutes, derivedMinutes)
      fromRooms += minutes / 60
    }

    // Return the maximum of all three sources
    const totalHours = Math.max(fromProfile, fromActivity, fromRooms)
    return Math.round(totalHours * 100) / 100
  } catch (err) {
    console.error('Error calculating total study hours:', err)
    return 0
  }
}

/**
 * Calculate study hours for multiple users efficiently
 * @param {Array<Object>} users - Array of user documents with _id
 * @returns {Promise<Map<string, number>>} Map of userId -> study hours
 */
export async function calculateStudyHoursForUsers(users) {
  try {
    const userIds = users.map(u => u._id)
    const userIdStrings = userIds.map(id => id.toString())

    // Get from StudyActivity
    const activityAgg = await StudyActivity.aggregate([
      { $match: { $expr: { $in: [{ $toString: '$userId' }, userIdStrings] } } },
      { $group: { _id: { $toString: '$userId' }, total: { $sum: '$hours' } } }
    ])
    const activityMap = new Map(activityAgg.map(a => [a._id, a.total || 0]))

    // Get from completed rooms
    const completedRooms = await Room.find({
      status: 'completed',
      $or: [
        { createdBy: { $in: userIds } },
        { participants: { $in: userIds } }
      ]
    }).select('createdBy participants duration createdAt endedAt').lean()

    const roomMinutesMap = new Map()
    for (const room of completedRooms) {
      const storedMinutes = Math.max(0, Number(room.duration) || 0)
      const derivedMinutes = room.endedAt && room.createdAt
        ? Math.max(0, Math.round((new Date(room.endedAt) - new Date(room.createdAt)) / 60000))
        : 0
      const minutes = Math.max(storedMinutes, derivedMinutes)
      
      if (minutes > 0) {
        const participants = new Set()
        if (room.createdBy) participants.add(room.createdBy.toString())
        if (Array.isArray(room.participants)) {
          room.participants.forEach(p => { if (p) participants.add(p.toString()) })
        }
        
        participants.forEach(uid => {
          roomMinutesMap.set(uid, (roomMinutesMap.get(uid) || 0) + minutes)
        })
      }
    }

    // Calculate final hours for each user
    const resultMap = new Map()
    for (const user of users) {
      const uid = user._id.toString()
      const fromProfile = Number(user.totalStudyHours) || 0
      const fromActivity = activityMap.get(uid) || 0
      const fromRooms = (roomMinutesMap.get(uid) || 0) / 60
      
      const totalHours = Math.max(fromProfile, fromActivity, fromRooms)
      resultMap.set(uid, Math.round(totalHours * 100) / 100)
    }

    return resultMap
  } catch (err) {
    console.error('Error calculating study hours for users:', err)
    return new Map()
  }
}

/**
 * Format study hours for display
 * @param {number} hours - Hours to format
 * @returns {string} Formatted string (e.g., "2.5h", "45m", "0m")
 */
export function formatStudyHours(hours) {
  const totalMinutes = Math.round(hours * 60)
  
  if (totalMinutes === 0) return '0m'
  if (totalMinutes < 60) return `${totalMinutes}m`
  
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
