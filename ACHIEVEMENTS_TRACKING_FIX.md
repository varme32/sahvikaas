# Achievements Tracking System - Implementation

## Problem
The achievements page was not tracking user activities or updating badge progress. Badge definitions existed, but there was no code to actually update the `BadgeProgress` collection when users performed activities.

## Solution
Implemented a comprehensive badge tracking system that automatically updates badge progress when users perform various activities.

## Changes Made

### 1. Badge Tracking Service (`backend/services/badgeTrackingService.js`)
Created a centralized service to handle all badge tracking logic:

**Functions:**
- `recalculateAllBadges(userId)` - Recalculates all badge progress from scratch by querying the database
- `trackSessionCompleted(userId, session)` - Tracks when a study session is completed
- `trackStudyHours(userId, hours)` - Tracks study hours logged
- `trackRoomJoined(userId)` - Tracks when a user joins a study room
- `trackRoomCreated(userId)` - Tracks when a user creates a study room
- `trackStreakUpdated(userId, currentStreak)` - Tracks streak updates
- `trackQuizCompleted(userId, score)` - Tracks quiz completions (90%+ scores)
- `trackResourceUploaded(userId, resourceType)` - Tracks resource uploads

**Badge Tracking:**
1. **Study Champion** - Tracks completed study sessions
2. **Focus Master** - Tracks total study hours
3. **Knowledge Seeker** - Tracks unique subjects studied
4. **Collaboration Star** - Tracks rooms joined
5. **Streak Master** - Tracks current study streak
6. **Innovation Pioneer** - Tracks rooms created
7. **Quiz Whiz** - Tracks high-score quizzes (90%+)
8. **Note Ninja** - Tracks document/PDF uploads
9. **Early Bird** - Tracks morning sessions (before 12 PM)
10. **Night Owl** - Tracks late-night study hours

### 2. Recent Sessions Enhancement
Added tracking to show whether users created or joined rooms in recent sessions:

#### Backend (`backend/routes/rooms.js`)
- Added `isCreator` field to identify if user created the room
- Added `userRole` field with values: `'created'` or `'joined'`
- Recent sessions now include this information in the API response

#### Frontend Updates
**RoomsPage** (`frontend/src/features/rooms/RoomsPage.jsx`)
- Displays icon and text showing if user created or joined each recent session
- Created rooms show a gold star icon with "You created this room"
- Joined rooms show a blue user icon with "You joined this room"

**DashboardPage** (`frontend/src/features/dashboard/DashboardPage.jsx`)
- Recent sessions show different icons based on user role
- Created rooms: Gold star icon
- Joined rooms: Blue video icon
- Displays "Created" or "Joined" label next to session details

#### Schedule Routes (`backend/routes/schedule.js`)
- Added tracking when study sessions are marked as completed
- Imports `trackSessionCompleted` from badge tracking service

#### Achievements Routes (`backend/routes/achievements.js`)
- Added tracking when study hours are logged
- Added tracking when streaks are updated
- Added new endpoint: `POST /api/achievements/recalculate` to manually recalculate all badges

#### Rooms Routes (`backend/routes/rooms.js`)
- Added tracking when users create rooms
- Added tracking when users join rooms
- Imports `trackRoomJoined` and `trackRoomCreated` from badge tracking service

#### Resources Routes (`backend/routes/resources.js`)
- Added tracking when resources are uploaded
- Imports `trackResourceUploaded` from badge tracking service

### 4. Migration Script (`backend/recalculate-badges.js`)
Created a standalone script to recalculate badges for all existing users:
```bash
node backend/recalculate-badges.js
```

This script:
- Connects to MongoDB
- Fetches all users
- Recalculates all badge progress for each user
- Provides a summary of processed/failed users

### 5. Frontend Updates

#### API Client (`frontend/src/lib/api.js`)
- Added `recalculateBadges()` function to call the recalculate endpoint

#### Achievements Page (`frontend/src/features/achievements/AchievementsPage.jsx`)
- Added "Refresh Badges" button in the page header
- Button triggers manual badge recalculation
- Shows loading state while recalculating
- Automatically reloads badge data after recalculation

## How It Works

### Automatic Tracking
When users perform activities, the tracking functions are called automatically:

1. **Complete a study session** → `trackSessionCompleted()` → Updates Study Champion, Knowledge Seeker, Early Bird badges
2. **Log study hours** → `trackStudyHours()` → Updates Focus Master, Night Owl badges
3. **Join a room** → `trackRoomJoined()` → Updates Collaboration Star badge
4. **Create a room** → `trackRoomCreated()` → Updates Innovation Pioneer badge
5. **Upload a resource** → `trackResourceUploaded()` → Updates Note Ninja badge
6. **Update streak** → `trackStreakUpdated()` → Updates Streak Master badge

### Manual Recalculation
Users can click the "Refresh Badges" button on the achievements page to:
- Recalculate all badges from scratch
- Fix any discrepancies
- Update progress based on current database state

### Database Migration
For existing users with historical data:
```bash
node backend/recalculate-badges.js
```

## Testing

### Test Badge Tracking
1. Complete a study session from the Schedule page
2. Join or create a study room
3. Upload a resource
4. Log study hours
5. Check the Achievements page to see updated badge progress

### Test Manual Recalculation
1. Go to Achievements page
2. Click "Refresh Badges" button
3. Wait for recalculation to complete
4. Verify badge progress is updated

### Test Migration Script
```bash
cd backend
node recalculate-badges.js
```

## Future Enhancements

1. **Real-time Updates** - Use WebSocket to push badge updates to the frontend
2. **Badge Notifications** - Show toast notifications when badges are earned
3. **Quiz Tracking** - Add userId to quiz submissions for better tracking
4. **Time-based Tracking** - Track actual time-of-day for Early Bird and Night Owl badges
5. **Badge Rewards** - Add XP or other rewards when badges are completed
6. **Custom Badges** - Allow admins to create custom badges with tracking rules

## Notes

- All tracking functions are non-blocking (use `.catch()` to prevent errors from breaking main flow)
- Badge progress is stored in the `BadgeProgress` collection with `userId` and `badgeId`
- The system uses `$inc` for increments and `$set` for absolute values
- Recalculation is idempotent - can be run multiple times safely
