# WebRTC Debug Instructions

## Critical Issue Found

Looking at your screenshots, I can see:
- Both users show "2 participants" 
- Each user sees their own video
- But the second video tile is BLACK (no remote stream)
- Chat messages show users joined successfully

This means:
1. ✅ Socket.IO connection works
2. ✅ Local media capture works
3. ❌ WebRTC peer connection NOT establishing
4. ❌ Remote streams NOT being received

## Immediate Testing Steps

### Step 1: Open Browser Console (CRITICAL)

**On BOTH tabs, press F12 and go to Console tab**

You MUST see these logs to diagnose the issue:

**Tab 1 (First user "ananth"):**
```
🚀 Connecting to room b2828fa7...
📹 Requesting camera and microphone access...
✅ Media stream acquired
🧊 Fetching ICE configuration...
✅ ICE configuration loaded
✅ Socket connected: [socket-id]
🔧 Setting up socket listeners...
📡 Joining meeting b2828fa7 as ananth
✅ Successfully connected to room
📥 Received existing participants: []  ← Should be empty for first user
```

**Tab 2 (Second user "jio"):**
```
🚀 Connecting to room b2828fa7...
📹 Requesting camera and microphone access...
✅ Media stream acquired
🧊 Fetching ICE configuration...
✅ ICE configuration loaded
✅ Socket connected: [socket-id]
🔧 Setting up socket listeners...
📡 Joining meeting b2828fa7 as jio
✅ Successfully connected to room
📥 Received existing participants: [{socketId: "xxx", name: "ananth"}]  ← Should show first user
📊 Current state: {hasLocalStream: true, localTracks: [...], ...}
🤝 Creating offer for ananth (xxx)
🆕 Creating new peer connection for ananth (xxx)
➕ Adding video track to peer connection for ananth
➕ Adding audio track to peer connection for ananth
   Peer connection has 2 senders: [...]
✅ Offer sent to ananth
```

**Back to Tab 1 (should receive offer):**
```
📥 Received offer from jio (yyy)
🆕 Creating new peer connection for jio (yyy)
➕ Adding video track to peer connection for jio
➕ Adding audio track to peer connection for jio
✅ Remote description set for jio
✅ Answer sent to jio
```

**Back to Tab 2 (should receive answer):**
```
📥 Received answer from ananth
✅ Remote description set from answer for ananth
```

**BOTH tabs should then show:**
```
🧊 Sending ICE candidate to [peer]
✅ ICE candidate added for [peer]
🔌 ICE connection state for [peer]: checking
🔌 ICE connection state for [peer]: connected
📥 Received video track from [peer]
📥 Received audio track from [peer]
✅ Setting remote stream for [peer], stream ID: [id]
   Stream has 2 tracks: [...]
✅ Updated participant [peer] with stream
🎥 Setting srcObject for [peer]
✅ Successfully connected to [peer]
```

## What to Look For

### ❌ Problem Indicators:

1. **"No local stream available to create offers!"**
   - Media wasn't captured before trying to connect
   - Solution: Refresh and allow camera/mic permissions

2. **"Socket failed to connect"**
   - Backend is down or unreachable
   - Check: https://sahvikaas.onrender.com/api/health

3. **"Received existing participants: []" on BOTH tabs**
   - Backend not tracking participants correctly
   - Backend needs restart

4. **Offer sent but no "Received offer" on other tab**
   - Socket.IO not forwarding messages
   - Check backend logs on Render

5. **"ICE connection state: failed"**
   - TURN servers not working
   - Firewall blocking WebRTC
   - Try different network

6. **No "Received video track" or "Received audio track"**
   - Tracks not being added to peer connection
   - Or tracks are disabled

7. **"Setting srcObject" but video still black**
   - Stream has no tracks
   - Or tracks are muted/disabled

### ✅ Success Indicators:

- `✅ Successfully connected to [peer]`
- `📥 Received video track from [peer]`
- `📥 Received audio track from [peer]`
- `🔌 ICE connection state: connected`
- `🎥 Setting srcObject for [peer]`

## Common Fixes

### Fix 1: Clear Browser Cache
```
1. Press Ctrl+Shift+Delete
2. Select "Cached images and files"
3. Clear data
4. Refresh both tabs
```

### Fix 2: Check Permissions
```
1. Click lock icon in address bar
2. Ensure Camera and Microphone are "Allow"
3. Refresh page
```

### Fix 3: Try Incognito Mode
```
1. Open Chrome Incognito (Ctrl+Shift+N)
2. Open room in two incognito windows
3. This eliminates extension interference
```

### Fix 4: Check Backend
```
Visit: https://sahvikaas.onrender.com/api/health
Should return: {"status":"ok","message":"StudyHub Backend Running"}

If not, backend is down - wait for Render to restart it
```

### Fix 5: Different Browser
```
Try in:
- Chrome (best WebRTC support)
- Edge (Chromium-based, good support)
- Firefox (good support)

Avoid:
- Safari (limited WebRTC support)
- Old browsers
```

## Network Requirements

WebRTC needs:
- **Outbound UDP** on ports 3478, 19302 (STUN)
- **Outbound TCP/UDP** on ports 80, 443 (TURN)
- **No VPN** (can interfere with peer connections)
- **Good internet** (at least 2 Mbps up/down)

Some networks that block WebRTC:
- Corporate firewalls
- School networks
- Public WiFi with restrictions
- Some mobile carriers

## Test on Same Network First

1. Connect both devices to same WiFi
2. This eliminates NAT traversal issues
3. If it works here but not across internet, it's a TURN server issue

## After Deploying New Code

1. **Wait 2-3 minutes** for Render to rebuild backend
2. **Hard refresh frontend** (Ctrl+Shift+R)
3. **Clear browser cache**
4. **Open console BEFORE joining room**
5. **Take screenshots of console logs**

## Send Me Console Logs

If still not working, copy and paste the ENTIRE console output from both tabs.

Look for:
- Any RED errors
- Missing expected log messages
- ICE connection state
- Whether tracks are received
