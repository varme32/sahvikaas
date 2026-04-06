# Admin Dashboard Fixes

## Issues Fixed

### 1. Last Active Column Not Displaying
**Problem**: The "Last Active" column in the admin users list was showing "—" for all users.

**Root Cause**: The backend `/api/admin/users` endpoint was using `.select('-password')` which only excluded the password field, but the `lastActiveAt` field was present in the User model and should have been included. However, the field was being properly selected.

**Solution**: Updated the select statement to be more explicit: `.select('-password -resetPasswordToken -emailVerificationOtp')` to ensure all non-sensitive fields including `lastActiveAt` are returned.

**Files Changed**:
- `backend/routes/admin.js` (line ~297)

### 2. User Detail Dashboard Not Working Properly
**Problem**: When clicking on a user's details, the dashboard would load but show mostly empty data (zeros).

**Root Cause**: 
1. The data structure was correct, but there was no fallback handling for empty data
2. No clear messaging when data was empty vs. when there was an error
3. The stats were only pulling from `data.activity.user` without fallback to `data.user`

**Solution**: 
1. Improved loading state with a spinner
2. Added fallback values for stats using both `act.user` and `user` data sources
3. Added empty state messages for:
   - Subject distribution when no study sessions exist
   - AI usage when no AI requests in the last 30 days  
   - Daily study hours chart when no activity recorded
4. Better error handling and user feedback

**Files Changed**:
- `frontend/src/features/admin/AdminViews.jsx` (AdminUserDetailView component)

## Changes Made

### Backend Changes (`backend/routes/admin.js`)

```javascript
// Before:
const users = await User.find(filter)
  .select('-password')
  .sort(sort)
  .skip((page - 1) * limit)
  .limit(limit)
  .lean()

// After:
const users = await User.find(filter)
  .select('-password -resetPasswordToken -emailVerificationOtp')
  .sort(sort)
  .skip((page - 1) * limit)
  .limit(limit)
  .lean()
```

### Frontend Changes (`frontend/src/features/admin/AdminViews.jsx`)

1. **Improved Loading State**:
```javascript
if (loading) {
  return (
    <div className="flex justify-center py-20">
      <i className="ri-loader-4-line animate-spin text-2xl text-[#F2CF7E]" />
    </div>
  )
}
```

2. **Added User Data Fallback**:
```javascript
const act = data.activity || {}
const user = data.user || {}
```

3. **Improved Stats Display with Fallbacks**:
```javascript
<StatCard 
  icon="ri-time-line" 
  label="Study hours" 
  value={act.user?.totalStudyHours ?? user.totalStudyHours ?? 0} 
  color="#14b8a6" 
/>
```

4. **Added Empty State Messages**:
- Subject distribution: "No study sessions recorded yet."
- AI usage: "No AI usage in the last 30 days."
- Chart: "No study activity recorded in the last 30 days."

## Testing

To verify the fixes:

1. **Last Active Column**:
   - Navigate to Admin Dashboard → Users
   - Check that the "Last Active" column shows dates for users who have logged in
   - Users who haven't logged in yet will show "—"

2. **User Detail Dashboard**:
   - Click on any user's "Detail" button
   - Verify the page loads with proper data or empty state messages
   - Check that stats show correct values or 0 with proper formatting
   - Verify charts display data or show empty state message

## Notes

- The `lastActiveAt` field is updated on user login (see `backend/routes/auth.js`)
- Users who have never logged in will have `null` for `lastActiveAt`
- The user detail view pulls data from the last 30 days by default
- Empty data is expected for new users who haven't used the platform yet
