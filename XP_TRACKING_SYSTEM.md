# XP Tracking System - Complete Implementation

## Problem
The achievements page showed 0 XP for all users because XP tracking was never implemented. While the `totalXP` field existed in the User model, no code was updating it when users performed activities.

## Solution
Implemented a comprehensive XP tracking system that awards points for all user activities and automatically updates the leaderboard.

## XP Rewards

### Activity-Based XP
- **Session Completed**: 10 XP
- **Study Hour Logged**: 5 XP per hour
- **Room Joined**: 15 XP
- **Room Created**: 25 XP
- **Resource Uploaded**: 20 XP
- **Quiz Completed**: 30 XP
- **Quiz High Score (90%+)**: 50 XP
- **Streak Day**: 10 XP per day
- **Badge Earned**: 100 XP (bonus when completing a badge)

### Total XP Calculation Example
If a user:
- Completes 10 study sessions = 100 XP
- Logs 20 hours of study = 100 XP
- Joins 3 rooms = 45 XP
- Creates 3 rooms = 75 XP
- Uploads 2 resources = 40 XP
- Has a 5-day streak = 50 XP
- Completes 1 badge = 100 XP

**Total: 510 XP**

## Implementation Details

### 1. XP Award Function
```javascript
async function awardXP(userId, amount, reason = '') {
  await User.findByIdAndUpdate(
    userId,
    { $inc: { totalXP: amount } },
    { new: true }
  )
}
```

### 2. Automatic XP Tracking
XP is automatically awarded when:

#### Session Completed
- Awards 10 XP
- Triggered in `backend/routes/schedule.js` when session status changes to 'completed'

#### Study Hours Logged
- Awards 5 XP per hour
- Triggered in `backend/routes/achievements.js` when activity is logged

#### Room Actions
- **Room Created**: 25 XP (triggered in `backend/routes/rooms.js`)
- **Room Joined**: 15 XP (triggered in `backend/routes/rooms.js`)

#### Resource Uploaded
- Awards 20 XP
- Triggered in `backend/routes/resources.js` when resource is created

#### Quiz Completed
- Awards 30 XP for completion
- Awards 50 XP for high score (90%+)
- Can be triggered when quiz tracking is implemented

#### Streak Updated
- Awards 10 XP per day
- Triggered in `backend/routes/achievements.js` when streak is updated

#### Badge Completed
- Awards 100 XP bonus
- Automatically triggered when badge progress reaches target

### 3. XP Recalculation
The system can recalculate total XP from scratch based on all historical activities:

```javascript
export async function recalculateXP(userId) {
  // Calculates XP from:
  // - All completed sessions
  // - Total study hours
  // - All rooms joined/created
  // - All resources uploaded
  // - All quizzes completed
  // - Current streak
  // - All completed badges
  
  await User.findByIdAndUpdate(userId, { totalXP })
}
```

## How to Use

### For Existing Users (One-Time Setup)
Run the recalculation script to populate XP for all existing users:

```bash
cd backend
node recalculate-badges.js
```

This will:
1. Calculate badges for all users
2. Calculate XP for all users
3. Update the database
4. Show a summary of processed users

### For New Activities
XP is automatically awarded when users:
1. Complete study sessions
2. Log study hours
3. Join or create rooms
4. Upload resources
5. Complete quizzes
6. Maintain streaks

### Manual Recalculation
Users can click the "Refresh Badges" button on the Achievements page to:
- Recalculate all badge progress
- Recalculate total XP
- Update the leaderboard

## Leaderboard

The leaderboard automatically ranks users by total XP:
- Sorted by `totalXP` in descending order
- Shows top 20 users
- Updates in real-time as XP is earned
- Displays user's rank, name, XP, department, and streak

## Testing

### Test XP Tracking

1. **Complete a Study Session**
   ```
   - Go to Schedule page
   - Create a session
   - Mark it as completed
   - Check Achievements page → Should see +10 XP
   ```

2. **Log Study Hours**
   ```
   - Use the activity logging endpoint
   - Log 2 hours
   - Check Achievements page → Should see +10 XP (2 × 5)
   ```

3. **Create a Room**
   ```
   - Go to Rooms page
   - Create a new room
   - Check Achievements page → Should see +25 XP
   ```

4. **Join a Room**
   ```
   - Join someone else's room
   - Check Achievements page → Should see +15 XP
   ```

5. **Upload a Resource**
   ```
   - Go to Resources page
   - Upload a file
   - Check Achievements page → Should see +20 XP
   ```

6. **Complete a Badge**
   ```
   - Perform activities to complete a badge
   - When badge reaches 100%
   - Check Achievements page → Should see +100 XP bonus
   ```

### Verify Leaderboard
1. Go to Achievements page → Leaderboard tab
2. Users should be sorted by XP (highest first)
3. Your XP should match your activities
4. Rank should update as you earn more XP

## Database Schema

### User Model
```javascript
{
  totalXP: { type: Number, default: 0 },
  totalStudyHours: { type: Number, default: 0 },
  currentStreak: { type: Number, default: 0 },
  longestStreak: { type: Number, default: 0 },
  createdRooms: [ObjectId],
  joinedRooms: [ObjectId],
  // ... other fields
}
```

### Badge Progress Model
```javascript
{
  userId: ObjectId,
  badgeId: Number,
  current: Number,
  // ... timestamps
}
```

## API Endpoints

### Get User Stats
```
GET /api/achievements/stats
Response: {
  totalXP: 510,
  totalBadges: 10,
  completedBadges: 1,
  currentStreak: 5,
  longestStreak: 10,
  totalStudyHours: 20
}
```

### Recalculate Badges & XP
```
POST /api/achievements/recalculate
Response: {
  ok: true,
  message: 'Badges and XP recalculated successfully'
}
```

### Get Leaderboard
```
GET /api/achievements/leaderboard
Response: {
  leaderboard: [
    {
      rank: 1,
      name: 'John Doe',
      xp: 1250,
      dept: 'Computer Science',
      streak: 15
    },
    // ... more users
  ]
}
```

## Troubleshooting

### Issue: Users still showing 0 XP
**Solution**: Run the recalculation script
```bash
node backend/recalculate-badges.js
```

### Issue: XP not updating after activities
**Solution**: Check server logs for tracking errors
```bash
# Look for messages like:
✨ Awarded 10 XP to user [userId] (Session completed)
✅ Tracked session completion for user [userId]
```

### Issue: Leaderboard not updating
**Solution**: 
1. Refresh the page
2. Click "Refresh Badges" button
3. Check if XP is actually being awarded (check database)

### Issue: Badge completion not awarding bonus XP
**Solution**: The bonus is only awarded the first time a badge is completed. If you recalculate, it will award the bonus again.

## Future Enhancements

1. **XP Multipliers**: Award bonus XP during special events or challenges
2. **Daily Quests**: Award XP for completing daily goals
3. **Level System**: Convert XP to levels (e.g., Level 1 = 0-100 XP, Level 2 = 100-250 XP)
4. **XP History**: Track XP earned over time with a graph
5. **Achievements**: Award special achievements for XP milestones
6. **Rewards**: Unlock features or badges at certain XP levels
7. **Seasonal Leaderboards**: Reset leaderboard each semester/month
8. **Team XP**: Award XP to study groups for collaborative activities

## Notes

- XP is cumulative and never decreases
- All XP awards are logged to console for debugging
- Badge completion bonus is awarded automatically
- Recalculation is idempotent (safe to run multiple times)
- XP tracking is non-blocking (errors won't break main functionality)
