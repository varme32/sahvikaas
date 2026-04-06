# Recent Sessions - Created/Joined Tracking Feature

## Overview
Added visual indicators to show whether users created or joined each room in their recent sessions list.

## Changes Made

### Backend Changes

#### `backend/routes/rooms.js`
Updated the `/api/rooms/user/stats` endpoint to include user role information:

```javascript
recentSessions: recentSessions.map(room => {
  const archiveExpiresAt = archiveByRoomId.get(String(room._id)) || null
  const isCreator = String(room.createdBy?._id) === String(userId)
  return {
    ...room.toObject(),
    hasArchive: Boolean(archiveExpiresAt),
    archiveExpiresAt,
    isCreator,
    userRole: isCreator ? 'created' : 'joined',
  }
})
```

**New Fields:**
- `isCreator` (boolean) - True if the user created the room
- `userRole` (string) - Either `'created'` or `'joined'`

### Frontend Changes

#### `frontend/src/features/rooms/RoomsPage.jsx`

**Data Mapping:**
Added user role fields to the recent sessions mapping:
```javascript
const mappedRecent = (statsData.recentSessions || []).map(r => ({
  // ... existing fields
  userRole: r.userRole || null,
  isCreator: r.isCreator || false,
}))
```

**Visual Display:**
Added a new row in the room card to show user role:
```jsx
{activeTab === 'recent' && room.userRole && (
  <div className="flex items-center gap-2 text-sm">
    <i className={room.userRole === 'created' ? 'ri-star-fill text-[#F2CF7E]' : 'ri-user-add-line text-blue-500'} />
    <span className={room.userRole === 'created' ? 'text-[#F2CF7E] font-medium' : 'text-blue-600 font-medium'}>
      {room.userRole === 'created' ? 'You created this room' : 'You joined this room'}
    </span>
  </div>
)}
```

**Visual Indicators:**
- **Created Rooms**: Gold star icon (⭐) with gold text
- **Joined Rooms**: Blue user-add icon (👤+) with blue text

#### `frontend/src/features/dashboard/DashboardPage.jsx`

**Data Mapping:**
Added user role fields to recent sessions:
```javascript
setRecentSessions((roomStats.recentSessions || []).slice(0, 5).map(r => ({
  // ... existing fields
  userRole: r.userRole || null,
  isCreator: r.isCreator || false,
})))
```

**Visual Display:**
Updated the icon and added a label:
```jsx
<div className="w-10 h-10 rounded-lg bg-[#F2CF7E]/10 flex items-center justify-center">
  <i className={`text-xl ${session.userRole === 'created' ? 'ri-star-fill text-[#F2CF7E]' : 'ri-video-line text-blue-500'}`} />
</div>
<div className="flex-1">
  <p className="text-sm font-medium text-black">{session.name}</p>
  <div className="flex items-center gap-2 mt-0.5">
    <p className="text-xs text-gray-600">{session.duration} • {session.time}</p>
    {session.userRole && (
      <span className={`text-xs font-medium ${session.userRole === 'created' ? 'text-[#F2CF7E]' : 'text-blue-600'}`}>
        • {session.userRole === 'created' ? 'Created' : 'Joined'}
      </span>
    )}
  </div>
</div>
```

**Visual Indicators:**
- **Created Rooms**: Gold star icon with "Created" label
- **Joined Rooms**: Blue video icon with "Joined" label

## User Experience

### Rooms Page - Recent Tab
When viewing recent sessions, users can now see:
1. A clear visual indicator (icon + text) showing their role
2. Gold highlighting for rooms they created
3. Blue highlighting for rooms they joined
4. Full text: "You created this room" or "You joined this room"

### Dashboard - Recent Sessions Widget
The dashboard shows a compact version:
1. Different icon colors based on role
2. Small label ("Created" or "Joined") next to session details
3. Consistent color scheme with the Rooms page

## Benefits

1. **Better Context**: Users can quickly identify which rooms they hosted vs participated in
2. **Visual Hierarchy**: Created rooms stand out with gold color, emphasizing ownership
3. **Consistent Design**: Uses the app's color scheme (#F2CF7E for primary actions)
4. **Improved UX**: No need to compare host names to figure out user's role

## Testing

### Test Scenarios

1. **Create a room and complete it**
   - Go to Rooms page → Recent tab
   - Should see gold star icon with "You created this room"
   - Dashboard should show gold star icon with "Created" label

2. **Join someone else's room and complete it**
   - Go to Rooms page → Recent tab
   - Should see blue user icon with "You joined this room"
   - Dashboard should show blue video icon with "Joined" label

3. **Mix of created and joined rooms**
   - Recent sessions should show different indicators for each
   - Created rooms should be visually distinct from joined rooms

## Future Enhancements

1. **Filtering**: Add ability to filter recent sessions by "Created" or "Joined"
2. **Statistics**: Show count of rooms created vs joined
3. **Badges**: Award badges for creating X rooms or joining Y rooms
4. **Sorting**: Allow sorting by role, date, or duration
5. **Export**: Include role information in session exports
