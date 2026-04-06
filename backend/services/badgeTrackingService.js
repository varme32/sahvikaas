import BadgeProgress from '../models/BadgeProgress.js'
import User from '../models/User.js'
import StudySession from '../models/StudySession.js'
import StudyActivity from '../models/StudyActivity.js'
import Room from '../models/Room.js'
import Resource from '../models/Resource.js'
import QuizSession from '../models/QuizSession.js'

// Badge IDs from achievements.js
const BADGE_IDS = {
  STUDY_CHAMPION: 1,        // Complete 50 study sessions
  FOCUS_MASTER: 2,          // Maintain focus for 100 hours
  KNOWLEDGE_SEEKER: 3,      // Complete 25 different subjects
  COLLABORATION_STAR: 4,    // Join 30 study groups
  STREAK_MASTER: 5,         // Maintain a 30-day study streak
  INNOVATION_PIONEER: 6,    // Create 10 study materials
  QUIZ_WHIZ: 7,             // Score 90%+ in 20 quizzes
  NOTE_NINJA: 8,            // Upload 15 quality notes
  EARLY_BIRD: 9,            // Attend 30 morning sessions
  NIGHT_OWL: 10,            // Study 50 late-night hours
}

// XP rewards for different activities
const XP_REWARDS = {
  SESSION_COMPLETED: 10,
  STUDY_HOUR: 5,
  ROOM_JOINED: 15,
  ROOM_CREATED: 25,
  RESOURCE_UPLOADED: 20,
  QUIZ_COMPLETED: 30,
  QUIZ_HIGH_SCORE: 50, // 90%+
  BADGE_EARNED: 100,
  STREAK_DAY: 10,
}

/**
 * Award XP to a user
 */
async function awardXP(userId, amount, reason = '') {
  try {
    await User.findByIdAndUpdate(
      userId,
      { $inc: { totalXP: amount } },
      { new: true }
    )
    console.log(`✨ Awarded ${amount} XP to user ${userId} (${reason})`)
  } catch (err) {
    console.error(`Failed to award XP to user ${userId}:`, err)
  }
}

/**
 * Check if a badge was just completed and award bonus XP
 */
async function checkBadgeCompletion(userId, badgeId) {
  try {
    const BADGE_TARGETS = {
      1: 50, 2: 100, 3: 25, 4: 30, 5: 30,
      6: 10, 7: 20, 8: 15, 9: 30, 10: 50
    }
    
    const progress = await BadgeProgress.findOne({ userId, badgeId })
    if (progress && progress.current >= BADGE_TARGETS[badgeId]) {
      // Check if this is the first time completing
      if (progress.current === BADGE_TARGETS[badgeId]) {
        await awardXP(userId, XP_REWARDS.BADGE_EARNED, `Badge ${badgeId} completed`)
      }
    }
  } catch (err) {
    console.error(`Failed to check badge completion:`, err)
  }
}

/**
 * Update badge progress for a user
 */
async function updateBadgeProgress(userId, badgeId, value) {
  try {
    const result = await BadgeProgress.findOneAndUpdate(
      { userId, badgeId },
      { $set: { current: value } },
      { upsert: true, new: true }
    )
    console.log(`📝 Updated badge ${badgeId} for user ${userId} to ${value} (was ${result?.current || 0})`)
    await checkBadgeCompletion(userId, badgeId)
  } catch (err) {
    console.error(`Failed to update badge ${badgeId} for user ${userId}:`, err)
  }
}

/**
 * Increment badge progress for a user
 */
async function incrementBadgeProgress(userId, badgeId, increment = 1) {
  try {
    const result = await BadgeProgress.findOneAndUpdate(
      { userId, badgeId },
      { $inc: { current: increment } },
      { upsert: true, new: true }
    )
    await checkBadgeCompletion(userId, badgeId)
    return result
  } catch (err) {
    console.error(`Failed to increment badge ${badgeId} for user ${userId}:`, err)
  }
}

/**
 * Recalculate all badge progress for a user from scratch
 */
export async function recalculateAllBadges(userId) {
  try {
    const user = await User.findById(userId)
    if (!user) return

    // Badge 1: Study Champion - Complete 50 study sessions
    const completedSessions = await StudySession.countDocuments({
      userId,
      status: 'completed'
    })
    await updateBadgeProgress(userId, BADGE_IDS.STUDY_CHAMPION, completedSessions)

    // Badge 2: Focus Master - Maintain focus for 100 hours
    // Use the same calculation as the dashboard (max of all sources)
    const { calculateTotalStudyHours } = await import('../lib/studyTimeUtils.js')
    const actualTotalHours = await calculateTotalStudyHours(userId, user)
    await updateBadgeProgress(userId, BADGE_IDS.FOCUS_MASTER, Math.floor(actualTotalHours))

    // Badge 3: Knowledge Seeker - Complete 25 different subjects
    const uniqueSubjects = await StudySession.distinct('subject', {
      userId,
      status: 'completed',
      subject: { $nin: ['', null] }
    })
    await updateBadgeProgress(userId, BADGE_IDS.KNOWLEDGE_SEEKER, uniqueSubjects.length)

    // Badge 4: Collaboration Star - Join 30 study groups
    const joinedRoomsCount = user.joinedRooms?.length || 0
    await updateBadgeProgress(userId, BADGE_IDS.COLLABORATION_STAR, joinedRoomsCount)

    // Badge 5: Streak Master - Maintain a 30-day study streak
    const streakData = await calculateStreak(userId)
    const currentStreak = streakData.currentStreak || 0
    await updateBadgeProgress(userId, BADGE_IDS.STREAK_MASTER, currentStreak)

    // Badge 6: Innovation Pioneer - Create 10 study materials
    const createdRoomsCount = user.createdRooms?.length || 0
    await updateBadgeProgress(userId, BADGE_IDS.INNOVATION_PIONEER, createdRoomsCount)

    // Badge 7: Quiz Whiz - Score 90%+ in 20 quizzes
    const highScoreQuizzes = await QuizSession.countDocuments({
      userId,
      score: { $gte: 90 }
    })
    await updateBadgeProgress(userId, BADGE_IDS.QUIZ_WHIZ, highScoreQuizzes)

    // Badge 8: Note Ninja - Upload 15 quality notes
    const uploadedResources = await Resource.countDocuments({
      uploadedBy: userId,
      type: { $in: ['pdf', 'document'] }
    })
    await updateBadgeProgress(userId, BADGE_IDS.NOTE_NINJA, uploadedResources)

    // Badge 9: Early Bird - Attend 30 morning sessions (before 12 PM)
    const morningSessions = await StudySession.countDocuments({
      userId,
      status: 'completed',
      time: { $regex: /^(0[0-9]|1[0-1]):/ } // Matches 00:00 to 11:59
    })
    await updateBadgeProgress(userId, BADGE_IDS.EARLY_BIRD, morningSessions)

    // Badge 10: Night Owl - Study 50 late-night hours (after 10 PM)
    const nightActivities = await StudyActivity.aggregate([
      { $match: { userId } },
      { $group: { _id: null, totalHours: { $sum: '$hours' } } }
    ])
    const nightHours = nightActivities[0]?.totalHours || 0
    // For simplicity, we'll use a portion of total hours as night hours
    // In a real implementation, you'd track time-of-day for each activity
    await updateBadgeProgress(userId, BADGE_IDS.NIGHT_OWL, Math.floor(nightHours * 0.3))

    console.log(`✅ Recalculated all badges for user ${userId}`)
  } catch (err) {
    console.error(`Failed to recalculate badges for user ${userId}:`, err)
  }
}

/**
 * Track when a study session is completed
 */
export async function trackSessionCompleted(userId, session) {
  try {
    // Award XP
    await awardXP(userId, XP_REWARDS.SESSION_COMPLETED, 'Session completed')
    
    // Badge 1: Study Champion
    await incrementBadgeProgress(userId, BADGE_IDS.STUDY_CHAMPION, 1)

    // Badge 3: Knowledge Seeker (if new subject)
    if (session.subject && session.subject.trim()) {
      await recalculateAllBadges(userId) // Recalc to get accurate unique subjects
    }

    // Badge 9: Early Bird (morning sessions)
    if (session.time && /^(0[0-9]|1[0-1]):/.test(session.time)) {
      await incrementBadgeProgress(userId, BADGE_IDS.EARLY_BIRD, 1)
    }

    console.log(`✅ Tracked session completion for user ${userId}`)
  } catch (err) {
    console.error(`Failed to track session for user ${userId}:`, err)
  }
}

/**
 * Track when study hours are logged
 */
export async function trackStudyHours(userId, hours) {
  try {
    // Award XP per hour
    const xpAmount = Math.floor(hours * XP_REWARDS.STUDY_HOUR)
    await awardXP(userId, xpAmount, `${hours} study hours`)
    
    // Badge 2: Focus Master - Update to reflect total study hours
    const user = await User.findById(userId).select('totalStudyHours')
    if (user) {
      const { calculateTotalStudyHours } = await import('../lib/studyTimeUtils.js')
      const actualTotalHours = await calculateTotalStudyHours(userId, user)
      const totalHours = Math.floor(actualTotalHours)
      console.log(`🎯 Focus Master: User ${userId} has ${actualTotalHours} total hours (calculated), updating badge to ${totalHours}`)
      await updateBadgeProgress(userId, BADGE_IDS.FOCUS_MASTER, totalHours)
    } else {
      console.log(`⚠️ User ${userId} not found when tracking study hours`)
    }

    // Badge 10: Night Owl (simplified - track portion as night hours)
    const nightHours = Math.floor(hours * 0.3)
    if (nightHours > 0) {
      await incrementBadgeProgress(userId, BADGE_IDS.NIGHT_OWL, nightHours)
    }

    // Calculate and update streak
    await calculateStreak(userId)

    console.log(`✅ Tracked ${hours} study hours for user ${userId}`)
  } catch (err) {
    console.error(`Failed to track study hours for user ${userId}:`, err)
  }
}

/**
 * Track when a user joins a room
 */
export async function trackRoomJoined(userId) {
  try {
    // Award XP
    await awardXP(userId, XP_REWARDS.ROOM_JOINED, 'Room joined')
    
    // Badge 4: Collaboration Star
    await incrementBadgeProgress(userId, BADGE_IDS.COLLABORATION_STAR, 1)

    console.log(`✅ Tracked room join for user ${userId}`)
  } catch (err) {
    console.error(`Failed to track room join for user ${userId}:`, err)
  }
}

/**
 * Track when a user creates a room
 */
export async function trackRoomCreated(userId) {
  try {
    // Award XP
    await awardXP(userId, XP_REWARDS.ROOM_CREATED, 'Room created')
    
    // Badge 6: Innovation Pioneer
    await incrementBadgeProgress(userId, BADGE_IDS.INNOVATION_PIONEER, 1)

    console.log(`✅ Tracked room creation for user ${userId}`)
  } catch (err) {
    console.error(`Failed to track room creation for user ${userId}:`, err)
  }
}

/**
 * Calculate and update user's study streak
 */
export async function calculateStreak(userId) {
  try {
    const user = await User.findById(userId)
    if (!user) return

    // Get all study activities sorted by date
    const activities = await StudyActivity.find({ userId })
      .sort({ date: -1 })
      .lean()

    if (activities.length === 0) {
      await User.findByIdAndUpdate(userId, {
        currentStreak: 0,
        longestStreak: 0
      })
      return
    }

    // Calculate current streak
    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 0
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Check if user studied today or yesterday
    const latestActivity = new Date(activities[0].date)
    latestActivity.setHours(0, 0, 0, 0)
    
    const daysDiff = Math.floor((today - latestActivity) / (1000 * 60 * 60 * 24))
    
    // If last activity was more than 1 day ago, streak is broken
    if (daysDiff > 1) {
      currentStreak = 0
    } else {
      // Calculate streak by checking consecutive days
      let expectedDate = new Date(today)
      if (daysDiff === 1) {
        expectedDate.setDate(expectedDate.getDate() - 1)
      }
      
      for (const activity of activities) {
        if (activity.hours === 0) continue
        
        const activityDate = new Date(activity.date)
        activityDate.setHours(0, 0, 0, 0)
        
        if (activityDate.getTime() === expectedDate.getTime()) {
          currentStreak++
          tempStreak++
          longestStreak = Math.max(longestStreak, tempStreak)
          expectedDate.setDate(expectedDate.getDate() - 1)
        } else if (activityDate < expectedDate) {
          // Gap in streak, reset temp streak
          tempStreak = 0
          break
        }
      }
    }

    // Calculate longest streak from all activities
    tempStreak = 0
    let prevDate = null
    
    for (const activity of activities.reverse()) {
      if (activity.hours === 0) continue
      
      const activityDate = new Date(activity.date)
      activityDate.setHours(0, 0, 0, 0)
      
      if (prevDate === null) {
        tempStreak = 1
      } else {
        const dayDiff = Math.floor((activityDate - prevDate) / (1000 * 60 * 60 * 24))
        if (dayDiff === 1) {
          tempStreak++
        } else {
          tempStreak = 1
        }
      }
      
      longestStreak = Math.max(longestStreak, tempStreak)
      prevDate = activityDate
    }

    // Update user's streak
    await User.findByIdAndUpdate(userId, {
      currentStreak,
      longestStreak: Math.max(longestStreak, user.longestStreak || 0)
    })

    // Track streak for badge
    if (currentStreak > 0) {
      await updateBadgeProgress(userId, BADGE_IDS.STREAK_MASTER, currentStreak)
    }

    console.log(`✅ Calculated streak for user ${userId}: current=${currentStreak}, longest=${longestStreak}`)
    return { currentStreak, longestStreak }
  } catch (err) {
    console.error(`Failed to calculate streak for user ${userId}:`, err)
    return { currentStreak: 0, longestStreak: 0 }
  }
}

/**
 * Track when a quiz is completed
 */
export async function trackQuizCompleted(userId, score) {
  try {
    // Award XP based on score
    const xpAmount = score >= 90 ? XP_REWARDS.QUIZ_HIGH_SCORE : XP_REWARDS.QUIZ_COMPLETED
    await awardXP(userId, xpAmount, `Quiz completed (${score}%)`)
    
    // Badge 7: Quiz Whiz (only count if score >= 90%)
    if (score >= 90) {
      await incrementBadgeProgress(userId, BADGE_IDS.QUIZ_WHIZ, 1)
      console.log(`✅ Tracked high-score quiz for user ${userId}: ${score}%`)
    }
  } catch (err) {
    console.error(`Failed to track quiz for user ${userId}:`, err)
  }
}

/**
 * Track when a resource is uploaded
 */
export async function trackResourceUploaded(userId, resourceType) {
  try {
    // Award XP
    await awardXP(userId, XP_REWARDS.RESOURCE_UPLOADED, 'Resource uploaded')
    
    // Badge 8: Note Ninja (only count documents/PDFs)
    if (['pdf', 'document'].includes(resourceType)) {
      await incrementBadgeProgress(userId, BADGE_IDS.NOTE_NINJA, 1)
      console.log(`✅ Tracked resource upload for user ${userId}`)
    }
  } catch (err) {
    console.error(`Failed to track resource upload for user ${userId}:`, err)
  }
}

/**
 * Track user login activity for streak calculation
 * Creates a minimal study activity entry for today if none exists
 */
export async function trackLoginActivity(userId) {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Check if there's already activity for today
    const existingActivity = await StudyActivity.findOne({ userId, date: today })
    
    if (!existingActivity) {
      // Create a minimal activity entry (0.01 hours) to mark the day as active
      await StudyActivity.create({
        userId,
        date: today,
        hours: 0.01
      })
      console.log(`✅ Tracked login activity for user ${userId} on ${today}`)
    }
    
    // Recalculate streak to update current/longest streak
    await calculateStreak(userId)
  } catch (err) {
    console.error(`Failed to track login activity for user ${userId}:`, err)
  }
}

export default {
  recalculateAllBadges,
  recalculateXP,
  calculateStreak,
  trackSessionCompleted,
  trackStudyHours,
  trackRoomJoined,
  trackRoomCreated,
  trackRoomCompletion,
  trackQuizCompleted,
  trackResourceUploaded,
  trackLoginActivity,
}

/**
 * Recalculate XP based on all activities
 */
export async function recalculateXP(userId) {
  try {
    const user = await User.findById(userId)
    if (!user) return

    let totalXP = 0

    // XP from completed sessions
    const completedSessions = await StudySession.countDocuments({
      userId,
      status: 'completed'
    })
    totalXP += completedSessions * XP_REWARDS.SESSION_COMPLETED

    // XP from study hours
    const studyHours = user.totalStudyHours || 0
    totalXP += Math.floor(studyHours * XP_REWARDS.STUDY_HOUR)

    // XP from rooms joined
    const joinedRoomsCount = user.joinedRooms?.length || 0
    totalXP += joinedRoomsCount * XP_REWARDS.ROOM_JOINED

    // XP from rooms created
    const createdRoomsCount = user.createdRooms?.length || 0
    totalXP += createdRoomsCount * XP_REWARDS.ROOM_CREATED

    // XP from resources uploaded
    const uploadedResources = await Resource.countDocuments({
      contributorId: userId
    })
    totalXP += uploadedResources * XP_REWARDS.RESOURCE_UPLOADED

    // XP from quizzes
    const quizzes = await QuizSession.find({ userId }).select('score')
    quizzes.forEach(quiz => {
      if (quiz.score >= 90) {
        totalXP += XP_REWARDS.QUIZ_HIGH_SCORE
      } else {
        totalXP += XP_REWARDS.QUIZ_COMPLETED
      }
    })

    // XP from streak
    const currentStreak = user.currentStreak || 0
    totalXP += currentStreak * XP_REWARDS.STREAK_DAY

    // XP from completed badges
    const badgeProgress = await BadgeProgress.find({ userId })
    const BADGE_TARGETS = {
      1: 50, 2: 100, 3: 25, 4: 30, 5: 30,
      6: 10, 7: 20, 8: 15, 9: 30, 10: 50
    }
    badgeProgress.forEach(progress => {
      if (progress.current >= BADGE_TARGETS[progress.badgeId]) {
        totalXP += XP_REWARDS.BADGE_EARNED
      }
    })

    // Update user's total XP
    await User.findByIdAndUpdate(userId, { totalXP })

    console.log(`✅ Recalculated XP for user ${userId}: ${totalXP} XP`)
    return totalXP
  } catch (err) {
    console.error(`Failed to recalculate XP for user ${userId}:`, err)
    return 0
  }
}

/**
 * Track when a room is completed - log study hours for all participants
 */
export async function trackRoomCompletion(roomId, participantIds, durationMinutes, roomSubject = '') {
  try {
    if (!participantIds || participantIds.length === 0) {
      console.log(`⚠️ No participants to track for room ${roomId}`)
      return
    }

    // Ensure duration is valid
    const validDuration = Math.max(0, Number(durationMinutes) || 0)
    if (validDuration === 0) {
      console.log(`⚠️ Room ${roomId} has 0 duration, skipping tracking`)
      return
    }

    const hours = validDuration / 60
    const today = new Date().toISOString().split('T')[0]

    console.log(`📊 Tracking room completion: ${validDuration} minutes (${hours.toFixed(2)} hours) for ${participantIds.length} participants`)

    // Log study hours for each participant
    for (const userId of participantIds) {
      try {
        // Add to StudyActivity
        await StudyActivity.findOneAndUpdate(
          { userId, date: today },
          { $inc: { hours } },
          { upsert: true, new: true }
        )

        // Update user's total study hours
        await User.findByIdAndUpdate(
          userId,
          {
            $inc: { totalStudyHours: hours },
            lastStudyDate: new Date(),
          }
        )

        // Create a completed study session for badge tracking
        const sessionTitle = `Study Room Session`
        await StudySession.create({
          userId,
          title: sessionTitle,
          subject: roomSubject || '',
          date: today,
          time: new Date().toTimeString().slice(0, 5),
          duration: `${Math.round(validDuration)}m`,
          type: 'Study',
          status: 'completed',
          notes: `Completed in study room ${roomId}`,
          colorIdx: Math.floor(Math.random() * 10),
        })

        // Track badges and XP
        await trackStudyHours(userId, hours)

        // Track session completion for Study Champion badge
        await incrementBadgeProgress(userId, BADGE_IDS.STUDY_CHAMPION, 1)

        // Track subject for Knowledge Seeker badge if provided
        if (roomSubject && roomSubject.trim()) {
          // Recalculate to get accurate unique subject count
          const uniqueSubjects = await StudySession.distinct('subject', {
            userId,
            status: 'completed',
            subject: { $nin: ['', null] }
          })
          await updateBadgeProgress(userId, BADGE_IDS.KNOWLEDGE_SEEKER, uniqueSubjects.length)
        }

        console.log(`✅ Tracked ${hours.toFixed(2)} hours for user ${userId} from room completion`)
      } catch (err) {
        console.error(`Failed to track room completion for user ${userId}:`, err)
      }
    }

    console.log(`✅ Tracked room completion for ${participantIds.length} participants`)
  } catch (err) {
    console.error(`Failed to track room completion:`, err)
  }
}

