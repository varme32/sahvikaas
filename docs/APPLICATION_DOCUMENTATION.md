# StudyHub / Sahvikaas — Application Documentation & Analytics Blueprint

## 1. Executive summary

**What it is:** A **full-stack collaborative learning web app** for students: authenticated users get a **dashboard**, **study rooms** with **real-time chat, tasks, shared notes, file resources, quizzes, points/leaderboard**, **video/audio/screen share** (WebRTC + optional mediasoup SFU), **scheduling** (sessions, exams, events, reminders), **resource library** (upload, folders, featured content), **achievements-style gamification UI**, and **AI study tools** (assistant, PDF/quiz/flashcards, etc.) backed by **OpenRouter / Gemini-class models**. **Admins** get a separate analytics-oriented console.

**Tech stack (high level):**

| Layer | Technology |
|--------|------------|
| Frontend | React 19, Vite, Tailwind, React Router (HashRouter), Socket.IO client, Recharts, mediasoup-client (SFU video path) |
| Backend | Node.js, Express, Socket.IO, Mongoose (MongoDB), JWT auth, bcrypt, Multer, Cloudinary (avatars), pdf-parse, optional mediasoup server module |
| Data | **MongoDB** for durable user and app data; **in-memory `Map`** for live room state; **TTL** on some collections |
| AI | OpenRouter API (`OPENROUTER_API_KEY`), PDF upload for summarization/quiz generation |

---

## 2. Product surface — features by area

### 2.1 Authentication & profile

- **Signup / login** (`/api/auth`): JWT stored client-side (`studyhub-token`), password hashed with bcrypt.
- **Profile**: name, bio, institution, major; **avatar** upload to Cloudinary (`/api/auth/avatar`).
- **Roles**: `user` | `admin` (admin routes protected by `adminAuthMiddleware`).

### 2.2 Dashboard

- **Summary API** (`GET /api/dashboard/summary`): last 5 **user resources**, upcoming **study sessions** and **exams**, **7-day study hours** from `StudyActivity`, **subject distribution** from **completed** `StudySession` records.

### 2.3 Study rooms (core differentiator)

- **MongoDB `Room`**: name, subject, creator, participants, privacy, AV defaults, scheduling (`scheduledFor`, `status`: scheduled/active/completed/cancelled), duration, max participants, ended flags.
- **REST**: create room, join, end, list active rooms for user, room detail, **user room history**, **user stats** (aggregates from `Room` + `StudySession`), **session archive** read/write.
- **Real-time (`server.js` + Socket.IO)**: isolated per-room state — participants, **waiting room** (host approve/deny), chat, typing, tasks, shared notes, resources & folders, **points** and in-room leaderboard, **quiz** state, WebRTC signaling (`offer` / `answer` / `ice-candidate`), media and screen-share events.
- **Session archive (`RoomSessionArchive`)**: On end, snapshot of chat (capped), tasks, notes, resources, folders, quiz results, leaderboard, summary counts; **TTL expiry** (`expiresAt`, `ROOM_SESSION_RETENTION_DAYS`, default 7 days).

### 2.4 Schedule

- **StudySession**: personal planned blocks (title, subject, date, time, duration, type, location, notes, status).
- **Exam**, **Event**, **Reminder**: exams with syllabus progress; events; reminders with priority and done flag.

### 2.5 Resources

- **Resource** documents: metadata, contributor, ratings/downloads, **per-user** `userId`, **folders**, tags, favorites, public flag.
- **Folder** model (same file as Resource): nested folders per user.
- Listings, featured, upload (local `/uploads` or parallel cloudinary route file), download counts.

### 2.6 AI tools

- **Routes in `routes/ai.js`**: assistant, quiz (PDF/topic), study plan, summarize, flashcards, doubt solver, exam predictor, assignment helper, etc.
- **Duplicate/legacy endpoints in `server.js`**: e.g. `/api/ai/chat`, `/api/ai/summarize-pdf`, meetings helpers — frontend `api.js` targets specific paths; worth consolidating in a refactor.

### 2.7 Gamification & social proof

- **User** fields: `totalStudyHours`, `currentStreak`, `longestStreak`, `totalXP`, room references.
- **StudyActivity**: daily hours per user (`YYYY-MM-DD`), unique index on `(userId, date)`.
- **BadgeProgress**: per-user progress per `badgeId` (definitions are **static** in `achievements.js`).
- **Leaderboard API**: sorts users by `totalXP` (see §5 for implementation gap).

### 2.8 Notifications

- **Notification**: type, title, message, optional `roomId`, read flag — e.g. room invites when creating a room with `invitedMembers`.

### 2.9 Admin

- **Dashboard analytics**: totals (users, resources, rooms, active rooms, quiz sessions), 30-day signups/room creations/uploads, category and room status breakdowns, **aggregated study hours** from `StudyActivity` (last 7 days), top users by XP, recent signups.
- **CRUD-style**: users (search, pagination, role edit), resources (delete, featured toggle), rooms (delete, force end).

### 2.10 Quiz (ephemeral + persisted code)

- **QuizSession** in MongoDB: share **code**, questions, host, time limit, results; **TTL ~2 hours** on documents.
- Additional REST under `server.js` for register/join/submit/results.

---

## 3. Data architecture

### 3.1 MongoDB collections (durable)

| Collection | Purpose |
|------------|---------|
| **users** | Identity, profile, aggregates (hours, streaks, XP), room id lists |
| **rooms** | Room metadata, participants, lifecycle, duration |
| **roomsessionarchives** | Post-session snapshots + TTL purge |
| **quizsessions** | Live quiz by code; short TTL |
| **studysessions** | Personal calendar study blocks |
| **exams**, **events**, **reminders** | User planning data |
| **resources**, **folders** | Library and personal files |
| **notifications** | In-app notifications |
| **studyactivities** | Daily hours for heatmaps / trends |
| **badgeprogresses** | Badge counters (schema ready) |

### 3.2 Ephemeral / in-memory

- **`rooms` Map in `server.js`**: live collaboration; **lost on server restart** unless reconciled from DB/archives.
- **Quiz** room state is also tied to memory + `QuizSession` for code lookup.

### 3.3 External blobs

- **Cloudinary**: profile images (URLs on user).
- **Local `/uploads`**: some resource uploads (depends on route used).

---

## 4. Per-user data — what you store and what you can infer

### 4.1 Stored per user (directly queryable)

- **Identity & profile**: email, name, bio, institution, major, avatar, `joinedAt`, `role`.
- **Engagement lists**: `createdRooms`, `joinedRooms` (ObjectId refs).
- **Aggregates on user document**: `totalStudyHours` (updated when **POST /api/achievements/activity** logs hours), `lastStudyDate`, `totalXP`, `currentStreak`, `longestStreak` — **note**: streak/XP fields exist in the DB, but **only `totalStudyHours` / `lastStudyDate` are clearly updated** from the achievements activity endpoint; **XP and streak are not consistently recomputed server-side** from the code paths reviewed, and **BadgeProgress is read but never written** in routes — so **badges/XP in production may stay at defaults until you add writers**.
- **StudyActivity**: time series of **hours per day** → retention, intensity, seasonality.
- **StudySession / Exam / Event / Reminder**: **intent and planning** — subjects, dates, workload, exam prep depth (`syllabusProgress`).
- **Resources**: contribution behavior, subjects, favorites, public vs private.
- **Notifications**: invite and engagement signals.

### 4.2 Derived analytics (per user)

| Signal | Source | Use |
|--------|--------|-----|
| Study consistency | `StudyActivity` | Streaks, risk of churn, best time to nudge |
| Subject focus | `StudySession` (completed), `Room.subject`, `Resource.subject` | Personalization, recommended rooms/peers |
| Collaboration | `joinedRooms` vs `createdRooms`, archive participation | Social learners vs solo |
| Session depth | `RoomSessionArchive` summary (if user participated) | Collaboration intensity per session |
| Content creation | resources uploaded, notes in archives | Creator score, quality signals (ratings/downloads) |
| Exam pressure | upcoming exams, syllabus % | Timely AI study plans, reminders |

---

## 5. Platform-level analytics (what exists vs what to add)

### 5.1 Already implemented (admin)

- User/resource/room counts, active rooms, new users (30d), time series for signups/rooms/uploads, resource categories, room statuses, top users by **XP** (see caveat below), recent users, **sum of study hours** across users by day (from `StudyActivity`).

### 5.2 Gaps for “end-to-end reporting”

- **Funnel**: signup → first room → first AI use → 7-day retention — needs **event logging** (see roadmap).
- **XP / badges**: schema supports it; **implement server-side rules** (e.g. on room end, quiz score, resource upload) and **persist BadgeProgress**.
- **AI usage**: no persistent **per-user token/call counts** in DB — required for cost control and “power user” segmentation.
- **Room archives** expire — for long-term analytics, **extract aggregates before TTL** or replicate to a **warehouse** (S3 + Athena, BigQuery, etc.).
- **Leaderboard UI** exposes weekly/monthly filters but **API appears all-time only** — align product and backend.

---

## 6. Startup-oriented analysis

### 6.1 Value proposition

- **All-in-one**: video study room + schedule + library + AI — reduces tool fragmentation for students.
- **Network effects**: rooms, invites, shared resources; **admin analytics** supports B2B (universities, coaching institutes).

### 6.2 Differentiation levers to emphasize

- **Session archives** for group accountability and revision.
- **Waiting room** for proctored/group discipline.
- **AI** tightly coupled to **user content** (PDFs, schedule) — strong personalization **once** you log usage and outcomes.

### 6.3 Monetization angles (data-informed)

- **Freemium AI quotas** (track tokens per user).
- **Institution dashboards** (already have admin patterns): seat management, department usage, compliance reports.
- **Premium archives / export** (PDF report of semester activity).

### 6.4 Risks

- **Privacy**: chat and notes in archives — need **retention policy**, **DSAR**, **encryption at rest**, and **clear consent** for analytics.
- **Operational**: single-node in-memory rooms — horizontal scaling needs **Redis** or similar for room state if you scale out.

---

## 7. Roadmap — personalized app & deep insights

1. **Event pipeline**: append-only `AnalyticsEvent` (userId, type, payload, ts) or product analytics (Segment, PostHog, self-hosted).
2. **Wire gamification**: on room end, quiz submit, resource upload → update `BadgeProgress`, `totalXP`, streaks **server-side** from `StudyActivity`.
3. **User insight API**: single `/api/users/me/insights` combining rooms, AI usage, subjects, cohort percentiles.
4. **Recommendation**: “rooms in your subjects”, “peers with similar schedule”, “next exam focus” using `Exam` + `StudyActivity`.
5. **Data warehouse**: nightly ETL from Mongo → warehouse for BI; keep PII in Mongo with pseudonymous keys in warehouse.
6. **Weekly email report**: study hours, streak, upcoming exams — driven by existing collections.

---

## 8. Summary table — “what we can take from the data”

| Data area | Business / product use |
|-----------|-------------------------|
| `StudyActivity` | Retention, workload trends, personalization of nudges |
| `Room` + archives | Collaboration metrics, session quality, subject popularity |
| `StudySession` / `Exam` | Academic calendar intelligence, AI study plans |
| `Resource` | Content marketplace metrics, contributor leaderboards |
| `Notification` + invites | Viral coefficient, invite acceptance (if you track opens) |
| Admin aggregates | Investor metrics, health of the platform |

---

*This document reflects the sahvikaas / StudyHub codebase structure, models, and API surface at documentation time.*
