# How to Restart the Backend Server

## The Issue
The code changes have been made, but the backend server is still running the OLD code. You need to restart it to load the new changes.

## Steps to Restart

### Option 1: Using Terminal (Recommended)
1. Open your terminal/command prompt
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Stop the current server (if running):
   - Press `Ctrl + C` in the terminal where the server is running
4. Start the server again:
   ```bash
   npm start
   ```
   OR
   ```bash
   node server.js
   ```

### Option 2: Using Process Manager (if using PM2)
```bash
pm2 restart backend
```
OR
```bash
pm2 restart all
```

### Option 3: Kill and Restart
If you can't find the terminal:
1. Find the Node process:
   ```bash
   # On Windows
   tasklist | findstr node
   taskkill /F /IM node.exe
   
   # On Linux/Mac
   ps aux | grep node
   kill -9 <process_id>
   ```
2. Then start the server again:
   ```bash
   cd backend
   npm start
   ```

## Verify the Fix
After restarting, check these pages for user "john":
1. **Dashboard** - Should show 2.67h
2. **Achievements** - Should NOW show 2.67h (currently shows 0.05h)
3. **Admin Panel Users List** - Should show 2h 40m (which is 2.67h)
4. **Admin Panel User Detail** - Should show 2.67h

All values should be consistent!

## What Changed
The new code calculates study time from ALL sources:
- User.totalStudyHours
- StudyActivity collection
- Room.duration

And takes the MAXIMUM value to ensure accuracy.
