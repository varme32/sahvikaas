# StudyHub — Real-Time Collaborative Study Room

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                  │
│                                                              │
│  StudyRoomPage                                               │
│  ├── VideoPanel ─────── WebRTC P2P video/audio               │
│  ├── ChatPanel ──────── Socket.IO real-time chat             │
│  ├── NotesPanel ─────── Socket.IO shared notes               │
│  ├── TasksPanel ─────── Socket.IO shared tasks               │
│  ├── ResourcesPanel ─── Socket.IO shared resources           │
│  ├── SettingsModal ──── Live participant list                 │
│  ├── PointsModal ────── Live points & leaderboard            │
│  ├── AIAssistant ────── REST API (Gemini)                    │
│  ├── PdfSummarizer ──── REST API (Gemini)                    │
│  ├── QuizGenerator ──── REST API (Gemini)                    │
│  └── VoiceAssistant ─── REST API (Gemini + Web Speech)       │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │ Socket.IO + REST API
┌──────────────────────▼───────────────────────────────────────┐
│                  Backend (Node.js + Express)                  │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Socket.IO Server                                       │ │
│  │  ├── Room Management (join/leave/reconnect)             │ │
│  │  ├── WebRTC Signaling (offer/answer/ICE candidates)     │ │
│  │  ├── Real-Time Chat (room-scoped broadcast)             │ │
│  │  ├── Typing Indicators                                  │ │
│  │  ├── Shared Tasks (CRUD + sync)                         │ │
│  │  ├── Shared Notes (CRUD + auto-save sync)               │ │
│  │  ├── Shared Resources (CRUD + sync)                     │ │
│  │  ├── Participant Presence (join/leave + media state)     │ │
│  │  └── Points & Leaderboard (activity-based scoring)      │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  REST API                                               │ │
│  │  ├── POST /api/ai/chat          AI Study Assistant      │ │
│  │  ├── POST /api/ai/summarize-pdf PDF Summarizer          │ │
│  │  ├── POST /api/ai/generate-quiz Quiz Generator          │ │
│  │  ├── POST /api/ai/voice         Voice Assistant         │ │
│  │  ├── POST /api/ai/enhance-notes Notes AI Enhancement    │ │
│  │  ├── POST /api/ai/smart-reply   @AI Chat Reply          │ │
│  │  ├── POST /api/meetings/create  Create Room             │ │
│  │  ├── GET  /api/meetings/:id     Room Info               │ │
│  │  ├── GET  /api/rooms/:id/state  Full Room State         │ │
│  │  └── GET  /api/health           Health Check            │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## How to Run Locally

### Prerequisites
- **Node.js** 18+ installed
- A **Gemini API Key** (for AI features — optional, real-time features work without it)
- A browser with WebRTC support (Chrome, Edge, Firefox)

### Step 1: Start the Backend

```bash
cd studyhub/backend

# Install dependencies
npm install

# Create a .env file (optional, for AI features)
echo "GEMINI_API_KEY=your_key_here" > .env

# Start the server
npm run dev
```

You should see:
```
🚀 StudyHub Backend running on http://localhost:5000
📹 WebRTC Signaling Server active
💬 Real-Time Chat active
📋 Real-Time Tasks active
📝 Real-Time Notes active
📁 Real-Time Resources active
🏆 Points & Leaderboard active
```

### Step 2: Start the Frontend

```bash
cd studyhub

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The app will be available at `http://localhost:5173/studyhub/`

---

## How to Test Multi-User Real-Time Collaboration

### Testing with Multiple Browser Tabs/Windows

1. **Open Browser Tab 1** → Navigate to `http://localhost:5173/studyhub/#/room/test-room`
2. **Open Browser Tab 2** → Navigate to `http://localhost:5173/studyhub/#/room/test-room`
3. **Open Browser Tab 3** (optional) → Same URL for a 3rd participant

> Use an **Incognito/Private window** for Tab 2 to get a different session and username.

### What to Test

#### ✅ Video Communication (WebRTC)
- Both tabs should show their own camera feed
- After a few seconds, each tab should see the other participant's video
- Toggle mic/video buttons — the other participant should see the status change
- Test screen sharing — click the screen share button

#### ✅ Real-Time Chat
- Click the **Chat** tab in the right panel
- Type a message in Tab 1 → It should **instantly appear** in Tab 2
- Type `@AI hello` to trigger an AI response visible to everyone
- Typing indicators should appear when someone is typing

#### ✅ Shared Tasks
- Click the **Tasks** tab
- Create a task in Tab 1 → It should **instantly appear** in Tab 2
- Check/uncheck a task → Status syncs across all tabs
- Delete a task → Removed from all tabs

#### ✅ Shared Notes
- Click the **Notes** tab
- Create a note in Tab 1 → It should appear in Tab 2's note list
- Edit a note → Changes auto-save and sync after 1.5s of inactivity
- Use AI tools (Summarize, Expand, etc.) → Enhanced content syncs to all

#### ✅ Shared Resources
- Click the **Resources** tab
- Create a folder or upload a resource → Appears in all tabs
- All resource metadata is shared in real-time

#### ✅ Participant Tracking
- Click the **Settings** (gear icon) → **Participants** tab
- Shows all connected users with their mic/video status and join time
- Participant count updates in real-time in the header bar

#### ✅ Points & Leaderboard
- Click the **Points** (coin icon)
- Points are awarded for: joining (5pts), sending messages (1pt/30s), creating tasks (2pts), completing tasks (3pts), creating notes (2pts), sharing resources (3pts)
- Leaderboard shows all participants ranked by points

#### ✅ Room Isolation
- Open another set of tabs at `http://localhost:5173/studyhub/#/room/other-room`
- Messages, tasks, notes sent in `test-room` should **NOT** appear in `other-room`

---

## Socket.IO Events Reference

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join-meeting` | `{ meetingId, userName }` | Join a room |
| `chat-send` | `{ meetingId, content }` | Send chat message |
| `chat-typing` | `{ meetingId, isTyping }` | Typing indicator |
| `task-add` | `{ meetingId, task: { text, dueDate } }` | Create shared task |
| `task-toggle` | `{ meetingId, taskId }` | Toggle task completion |
| `task-delete` | `{ meetingId, taskId }` | Delete task |
| `note-create` | `{ meetingId, note: { title, content } }` | Create shared note |
| `note-update` | `{ meetingId, noteId, title?, content? }` | Update shared note |
| `note-delete` | `{ meetingId, noteId }` | Delete shared note |
| `resource-folder-create` | `{ meetingId, name }` | Create resource folder |
| `resource-add` | `{ meetingId, resource: { name, type, size, folderId } }` | Share a resource |
| `resource-delete` | `{ meetingId, resourceId }` | Delete resource |
| `get-points` | `{ meetingId }` | Request points data |
| `offer` | `{ to, offer }` | WebRTC offer |
| `answer` | `{ to, answer }` | WebRTC answer |
| `ice-candidate` | `{ to, candidate }` | ICE candidate |
| `media-state` | `{ meetingId, audio, video }` | Media toggle |
| `screen-share` | `{ meetingId, sharing }` | Screen share status |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `room-state` | Full room state object | Sent on join (chat history, tasks, notes, etc.) |
| `existing-participants` | Array of participants | Existing users for WebRTC setup |
| `user-joined` | Participant object | New user joined |
| `user-left` | `{ id }` | User disconnected |
| `participants-updated` | Array of all participants | Updated participant list |
| `chat-message` | Message object | New chat message |
| `chat-typing` | `{ userId, userName, isTyping }` | Typing indicator |
| `tasks-updated` | Array of all tasks | Tasks list changed |
| `notes-updated` | Array of all notes | Notes list changed |
| `resources-updated` | `{ resources, folders }` | Resources changed |
| `points-updated` | `{ leaderboard, userPoints? }` | Points/leaderboard changed |
| `offer` | `{ from, offer, userName }` | WebRTC offer |
| `answer` | `{ from, answer }` | WebRTC answer |
| `ice-candidate` | `{ from, candidate }` | ICE candidate |
| `media-state` | `{ from, audio, video }` | Peer media toggle |
| `screen-share` | `{ from, sharing, userName }` | Peer screen share |

---

## Room State Model

Each room maintains this in-memory state:

```javascript
{
  id: 'room-id',
  createdBy: 'Host',
  createdAt: '2026-02-19T...',
  participants: Map<socketId, {
    id, name, socketId, joinedAt, audioOn, videoOn
  }>,
  chatMessages: [{ id, type, user, userId, content, time, timestamp }],
  tasks: [{ id, text, dueDate, completed, createdBy, createdAt }],
  sharedNotes: [{ id, title, content, createdBy, createdAt, updatedAt }],
  resources: [{ id, name, type, size, folderId, uploadedBy, uploadedAt }],
  folders: [{ id, name, createdBy }],
  points: Map<userName, { points, activities: [] }>
}
```

- Rooms are auto-created when the first user joins
- Empty rooms are cleaned up after 10 minutes
- Late joiners receive the full current state on connect
- All state is room-scoped — no cross-room data leakage
