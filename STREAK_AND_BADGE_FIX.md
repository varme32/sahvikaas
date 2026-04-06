# Streak Calculation & Badge Tracking Fix

## Issues Found

### 1. Streak Not Updating (0/30 days)
**Problem**: The streak was never being calculated. The code only tracked when streak was "updated" but never actually calculated the streak from study activities.

**Root Cause**: No logic existed to:
- Check consecutive days of study activity
- Calculate current streak
- Calculate longest streak
- Update the User model with streak values

### 2. Badges Not Calculating Properly
**Problem**: Some badges showed progress (Collaboration Star: 25/30, Innovation Pioneer: 24/10) but others were at 0%.

**Root Cause**: The recalculation function existed but wasn't being called automatically, and streak calculation was missing.

### 3. Quiz Generator Concern
**Status**: ✅ NO CHANGES MADE
- Verified with `git diff` - no modifications to quiz generator files
- QuizGeneratorPanel.jsx is unchanged
- QuizGenerator.jsx is unchanged

## Solutions Implemented

### 1. Streak Calculation Function

Created `calculateStreak(userId)` function that:

```javascript
export async function calculateStreak(userId) {
  // 1. Get all study activities sorted by date
  // 2. Check if user studied today or yesterday
  // 3. Calculate current streak (consecutive days)
  // 4. Calculate longest streak (all-time)
  // 5. Update User model with both values
  // 6. Update Streak Master badge progress
}
```

**How it works:**
- Fetches all StudyActivity records for the user
- Checks if last activity was today or yesterday (if more than 1 day ago, streak is broken)
- Counts consecutive days backwards from today/yesterday
- Calculates longest streak from entire history
- Updates `currentStreak` and `longestStreak` in User model
- Updates Badge #5 (Streak Master) progress

**Streak Rules:**
- Must study at least once per day to maintain streak
- If you miss a day, streak resets to 0
- Longest streak is preserved even if current streak breaks
- Only activities with hours > 0 count towards streak

### 2. Automatic Streak Calculation

Integrated streak calculation into `trackStudyHours()`:

```javascript
export async function trackStudyHours(userId, hours) {
  // Award XP
  // Update badges
  // Calculate and update streak ← NEW
}
```

**When streak is calculated:**
- Every time study hours are logged
- During badge recalculation
- Automatically updates both current and longest streak

### 3. Badge Recalculation Enhancement

Updated `recalculateAllBadges()` to properly calculate streak:

```javascript
// OLD (incorrect)
const currentStreak = user.currentStreak || 0
await updateBadgeProgress(userId, BADGE_IDS.STREAK_MASTER, currentStreak)

// NEW (correct)
const streakData = await calculateStreak(userId)
const currentStreak = streakData.currentStreak || 0
await updateBadgeProgress(userId, BADGE_IDS.STREAK_MASTER, currentStreak)
```

## How to Fix Current Data

### Option 1: Run Recalculation Script (Recommended)
```bash
cd backend
node recalculate-badges.js
```

This will:
- ✅ Calculate streaks for all users
- ✅ Recalculate all badge progress
- ✅ Recalculate all XP
- ✅ Update the database

### Option 2: Use UI Button
1. Go to Achievements page
2. Click "Refresh Badges" button
3. Wait for completion

### Option 3: Log Study Hours
Simply log some study hours and the streak will be calculated automatically:
1. Go to any page that logs study activity
2. Log hours for today
3. Streak will be calculated and updated

## Expected Results After Fix

### Streak Calculation
- ✅ Current streak shows actual consecutive days
- ✅ Longest streak shows all-time best
- ✅ Streak Master badge updates (0-30 days)
- ✅ Streak displayed on leaderboard
- ✅ Streak displayed in stats

### Badge Progress
All badges should show correct progress:
1. **Study Champion** (0/50 sessions) - Based on completed StudySessions
2. **Focus Master** (0/100 hours) - Based on totalStudyHours
3. **Knowledge Seeker** (0/25 subjects) - Based on unique subjects in completed sessions
4. **Collaboration Star** (25/30 groups) - Based on joinedRooms array length
5. **Streak Master** (0/30 days) - Based on calculated current streak
6. **Innovation Pioneer** (24/10 materials) - Based on createdRooms array length
7. **Quiz Whiz** (0/20 quizzes) - Based on QuizSession with score >= 90%
8. **Note Ninja** (0/15 notes) - Based on Resources with type pdf/document
9. **Early Bird** (0/30 sessions) - Based on sessions with time before 12 PM
10. **Night Owl** (0/50 hours) - Based on study hours (estimated 30% as night hours)

## Testing

### Test Streak Calculation

1. **Create Study Activity for Today**
   ```javascript
   // POST /api/achievements/activity
   {
     "date": "2026-04-01",
     "hours": 2
   }
   ```
   Expected: Current streak = 1 day

2. **Create Activity for Yesterday**
   ```javascript
   // POST /api/achievements/activity
   {
     "date": "2026-03-31",
     "hours": 1
   }
   ```
   Expected: Current streak = 2 days

3. **Create Activity for 3 Days Ago (Gap)**
   ```javascript
   // POST /api/achievements/activity
   {
     "date": "2026-03-29",
     "hours": 1
   }
   ```
   Expected: Current streak = 2 days (gap breaks streak)

4. **Check Achievements Page**
   - Go to Achievements → Activity Streaks tab
   - Should see: Current Streak = 2 days
   - Should see: Longest Streak = 2 days
   - Streak Master badge should show 2/30 days (6%)

### Test Badge Recalculation

1. **Click "Refresh Badges" Button**
   - All badges should update based on actual data
   - Collaboration Star: Based on rooms joined
   - Innovation Pioneer: Based on rooms created
   - Streak Master: Based on calculated streak

2. **Verify Each Badge**
   - Check database for actual counts
   - Compare with badge progress shown
   - Should match exactly

## Troubleshooting

### Issue: Streak still showing 0
**Solution**: 
1. Check if you have any StudyActivity records with hours > 0
2. Run recalculation script
3. Log study hours for today

### Issue: Streak seems wrong
**Solution**:
1. Check StudyActivity collection for your userId
2. Verify dates are in YYYY-MM-DD format
3. Ensure hours > 0 for activities
4. Run recalculation to fix

### Issue: Badges not updating
**Solution**:
1. Click "Refresh Badges" button
2. Check server logs for errors
3. Verify data exists (sessions, rooms, resources, etc.)
4. Run recalculation script

### Issue: Innovation Pioneer shows 240% (24/10)
**Explanation**: This is correct! The user has created 24 rooms, which exceeds the target of 10. The badge is completed and shows 240% progress.

## Code Changes Summary

### Files Modified
1. `backend/services/badgeTrackingService.js`
   - Added `calculateStreak()` function
   - Updated `trackStudyHours()` to call `calculateStreak()`
   - Updated `recalculateAllBadges()` to use `calculateStreak()`
   - Removed `trackStreakUpdated()` (replaced by `calculateStreak()`)

2. `backend/routes/achievements.js`
   - Removed `trackStreakUpdated` import
   - Removed manual streak tracking call
   - Streak now calculated automatically in `trackStudyHours()`

### Files NOT Modified
- ✅ `frontend/src/features/studyroom/components/QuizGeneratorPanel.jsx`
- ✅ `frontend/src/features/aitools/tools/QuizGenerator.jsx`
- ✅ All quiz-related functionality unchanged

## Next Steps

1. **Run the recalculation script** to fix all existing user data:
   ```bash
   node backend/recalculate-badges.js
   ```

2. **Test streak calculation** by logging study hours

3. **Verify badges** on the Achievements page

4. **Check leaderboard** to see updated XP and streaks

All future activities will automatically track correctly!
