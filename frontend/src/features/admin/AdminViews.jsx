import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { io } from 'socket.io-client'
import {
  getAdminDashboard,
  getAdminUsers,
  updateAdminUser,
  getAdminResources,
  deleteAdminResource,
  toggleAdminResourceFeatured,
  getAdminRooms,
  deleteAdminRoom,
  endAdminRoom,
  promoteToAdmin,
  getAdminUserDetail,
  banAdminUser,
  unbanAdminUser,
  warnAdminUser,
  resetAdminUserStats,
  updateAdminUserAiQuota,
  getAdminAnalyticsAdvanced,
  getAdminAiUsageSummary,
  getAdminModerationCases,
  updateAdminModerationCase,
  scanAdminSpam,
  broadcastAdminNotification,
  getAdminGamification,
  putAdminGamification,
  postAdminGamificationBadge,
  getAdminXpLeaderboard,
  getAdminRoomLive,
  adminRemoveLiveUser,
  getReportsForUser,
  adminGenerateReportForUser,
  downloadReportBlob,
  getToken,
} from '../../lib/api'

/* ─── shared ─── */
function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 ${className}`}>{children}</div>
}

function StatCard({ icon, label, value, sub, color = '#6366f1' }) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}18` }}>
          <i className={`${icon} text-xl`} style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
    </Card>
  )
}

/* ─── Dashboard ─── */
export function AdminDashboardView() {
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    getAdminDashboard()
      .then(d => { if (d.ok) setData(d) })
      .catch(e => setErr(e.message))
  }, [])

  if (err) {
    return (
      <Card>
        <p className="text-red-600 text-sm">{err}</p>
      </Card>
    )
  }
  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <i className="ri-loader-4-line animate-spin text-2xl text-[#F2CF7E]" />
      </div>
    )
  }

  const { stats, charts } = data
  const signups = charts.userSignups?.map(d => ({ name: d.date.slice(5), v: d.count })) || []
  const hoursTrend = charts.studyHoursTrend?.map(d => ({ name: d.date.slice(5), hours: d.hours })) || []
  const aiTrend = charts.aiUsageTrend?.map(d => ({ name: d.date.slice(5), requests: d.count })) || []
  const roomsTrend = charts.roomCreations?.map(d => ({ name: d.date.slice(5), rooms: d.count })) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">Platform overview and trends</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon="ri-user-line" label="Total users" value={stats.totalUsers} color="#6366f1" sub={`DAU ${stats.dau} · WAU ${stats.wau}`} />
        <StatCard icon="ri-time-line" label="Study hours (all)" value={stats.totalStudyHours} color="#14b8a6" />
        <StatCard icon="ri-live-line" label="Active rooms" value={stats.activeRooms} color="#22c55e" sub={`${stats.totalRooms} total`} />
        <StatCard icon="ri-robot-line" label="AI requests" value={stats.aiRequests} color="#8b5cf6" sub={`${stats.totalResources} resources`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">User growth (30d)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={signups}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="v" fill="#6366f1" radius={[4, 4, 0, 0]} name="Signups" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Study hours trend (30d)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hoursTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="hours" stroke="#14b8a6" strokeWidth={2} dot={false} name="Hours" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Room creation (30d)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={roomsTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="rooms" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">AI usage trend (30d)</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aiTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="requests" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Top XP</h3>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {data.topUsers?.map((u, i) => (
              <li key={u._id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">#{i + 1} {u.name}</span>
                <span className="font-semibold text-indigo-600">{u.totalXP} XP</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recent signups</h3>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {data.recentUsers?.map(u => (
              <li key={u._id} className="flex justify-between text-sm text-gray-600">
                <span>{u.name}</span>
                <span className="text-xs">{new Date(u.createdAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

/* ─── Users ─── */
export function AdminUsersView() {
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const formatStudyDuration = (hours, minutesFallback) => {
    const fromHours = Number(hours)
    const fromMinutes = Number(minutesFallback)

    const hasPositiveHours = Number.isFinite(fromHours) && fromHours > 0
    const hasPositiveMinutes = Number.isFinite(fromMinutes) && fromMinutes > 0

    let totalMinutes = 0
    if (hasPositiveHours) {
      totalMinutes = Math.round(fromHours * 60)
    } else if (hasPositiveMinutes) {
      totalMinutes = Math.round(fromMinutes)
    }

    if (totalMinutes <= 0) return '0m'

    if (totalMinutes < 60) {
      return `${totalMinutes}m`
    }

    const hoursValue = totalMinutes / 60
    return `${(Math.round(hoursValue * 10) / 10).toFixed(1)}h`
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getAdminUsers({ page, search, limit: 20 })
      if (d.ok) {
        setUsers(d.users)
        setPages(d.pages)
      }
    } catch { /* */ }
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">Search, manage roles, open detail</p>
        </div>
        <input
          type="search"
          placeholder="Search name or email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm max-w-md w-full"
        />
      </div>
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3 hidden md:table-cell">Study H</th>
              <th className="px-4 py-3">XP</th>
              <th className="px-4 py-3 hidden sm:table-cell">Streak</th>
              <th className="px-4 py-3 hidden lg:table-cell">Last active</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-400">Loading…</td></tr>
            ) : users.map(u => (
              <tr key={u._id} className="border-t border-gray-50 hover:bg-gray-50/80">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/users/${u._id}`)}
                    className="font-medium text-indigo-600 hover:underline text-left"
                  >
                    {u.name}
                  </button>
                  <p className="text-xs text-gray-400 truncate max-w-[180px]">{u.email}</p>
                  {u.banned && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 rounded">Banned</span>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">{formatStudyDuration(u.studyHours ?? u.totalStudyHours, u.studyMinutes)}</td>
                <td className="px-4 py-3">{u.totalXP ?? 0}</td>
                <td className="px-4 py-3 hidden sm:table-cell">{u.currentStreak ?? 0}</td>
                <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                  {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/users/${u._id}`)}
                    className="text-xs text-[#b5942e] font-medium"
                  >
                    Detail
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded-lg text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-600 py-1">{page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded-lg text-sm disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}

/* ─── User detail ─── */
export function AdminUserDetailView() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getAdminUserDetail(userId)
      if (d.ok) setData(d)
    } catch { setData(null) }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return <div className="py-20 text-center text-gray-400">Loading user…</div>
  }
  if (!data?.user) {
    return <Card>User not found.</Card>
  }

  const act = data.activity || {}
  const chartData = (act.studyActivityDaily || []).map(d => ({ name: d.date?.slice(5), hours: d.hours }))

  const doBan = async () => {
    const reason = window.prompt('Ban reason?', 'Policy violation')
    if (reason === null) return
    try {
      await banAdminUser(userId, reason)
      load()
    } catch (e) { alert(e.message) }
  }
  const doUnban = async () => {
    try { await unbanAdminUser(userId); load() } catch (e) { alert(e.message) }
  }
  const doReset = async () => {
    if (!window.confirm('Reset all stats and badge progress for this user?')) return
    try { await resetAdminUserStats(userId); load() } catch (e) { alert(e.message) }
  }
  const doPromote = async () => {
    try {
      await updateAdminUser(userId, { role: 'admin' })
      load()
    } catch (e) { alert(e.message) }
  }
  const saveAi = async () => {
    const daily = window.prompt('Daily token limit (blank = unlimited)', '')
    const monthly = window.prompt('Monthly request limit (blank = unlimited)', '')
    const disabled = window.prompt('Disabled features (comma-separated, or * for all)', '')
    try {
      await updateAdminUserAiQuota(userId, {
        dailyTokenLimit: daily === '' ? null : Number(daily),
        monthlyRequestLimit: monthly === '' ? null : Number(monthly),
        disabledFeatures: disabled ? disabled.split(',').map(s => s.trim()).filter(Boolean) : [],
      })
      alert('Saved AI quota')
      load()
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => navigate('/admin/users')} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
        <i className="ri-arrow-left-line" /> Users
      </button>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{data.user.name}</h1>
          <p className="text-sm text-gray-500">{data.user.email}</p>
          <p className="text-xs text-gray-400 mt-1">Reports generated: {data.reportsCount ?? 0}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.user.banned ? (
            <button type="button" onClick={doUnban} className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold">Unban</button>
          ) : (
            <button type="button" onClick={doBan} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold">Ban</button>
          )}
          <button type="button" onClick={() => warnAdminUser(userId, 'Please follow community guidelines.').then(load).catch(e => alert(e.message))} className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-800 text-xs font-semibold">Warn</button>
          <button type="button" onClick={doPromote} className="px-3 py-1.5 rounded-lg border text-xs font-semibold">Make admin</button>
          <button type="button" onClick={doReset} className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold">Reset stats</button>
          <button type="button" onClick={saveAi} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold">AI limits</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon="ri-time-line" label="Study hours" value={act.user?.totalStudyHours} color="#14b8a6" />
        <StatCard icon="ri-trophy-line" label="XP" value={act.user?.totalXP} color="#6366f1" />
        <StatCard icon="ri-fire-line" label="Streak" value={act.user?.currentStreak} color="#f97316" />
        <StatCard icon="ri-group-line" label="Rooms J/C" value={`${act.roomsJoined ?? 0} / ${act.roomsCreated ?? 0}`} color="#8b5cf6" />
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Daily study hours (last 30d)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="hours" fill="#F2CF7E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h3 className="text-sm font-semibold mb-2">Subject distribution</h3>
          <ul className="text-sm space-y-1">
            {(act.subjectDistribution || []).map(s => (
              <li key={s.name} className="flex justify-between text-gray-600">
                <span>{s.name}</span>
                <span>{s.percent}%</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="text-sm font-semibold mb-2">AI usage (period)</h3>
          <ul className="text-sm space-y-1 max-h-48 overflow-y-auto">
            {(act.aiUsageByFeature || []).map(a => (
              <li key={a.feature} className="flex justify-between text-gray-600">
                <span className="truncate max-w-[140px]">{a.feature}</span>
                <span>{a.requests} req</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

/* ─── Rooms + live ─── */
export function AdminRoomsView() {
  const [rooms, setRooms] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [status, setStatus] = useState('')
  const [liveId, setLiveId] = useState('')
  const [live, setLive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedRoom, setExpandedRoom] = useState(null)
  const [selectedDetailRoom, setSelectedDetailRoom] = useState(null)

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getAdminRooms({ page, status, limit: 15 })
      if (d.ok) { setRooms(d.rooms); setPages(d.pages) }
    } catch { /* */ }
    setLoading(false)
  }, [page, status])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  const pollLive = useCallback(async () => {
    if (!liveId) return
    try {
      const d = await getAdminRoomLive(liveId)
      if (d.ok) setLive(d)
    } catch { setLive(null) }
  }, [liveId])

  useEffect(() => {
    if (!liveId) { setLive(null); return undefined }
    pollLive()
    const t = setInterval(pollLive, 4000)
    return () => clearInterval(t)
  }, [liveId, pollLive])

  useEffect(() => {
    if (!liveId) return undefined
    const token = getToken()
    const url = import.meta.env.VITE_SOCKET_URL || undefined
    const s = io(url, { path: '/socket.io', transports: ['websocket', 'polling'] })
    s.on('connect', () => {
      s.emit('admin:subscribe-room', { token, meetingId: liveId })
    })
    s.on('admin:live-update', () => { pollLive() })
    return () => { s.disconnect() }
  }, [liveId, pollLive])

  const removeSock = async socketId => {
    if (!window.confirm('Remove this participant from the live session?')) return
    try {
      await adminRemoveLiveUser(liveId, socketId)
      pollLive()
    } catch (e) { alert(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rooms</h1>
          <p className="text-sm text-gray-500">View all rooms with participants and details</p>
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="border border-gray-200 rounded-xl px-3 py-2 text-sm">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>

      {live?.live && (
        <Card>
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-semibold text-gray-800">{live.name}</h3>
              <p className="text-xs text-gray-500">Session ~{live.durationMinutes} min · {live.participants?.length || 0} live participants</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Live Participants</p>
              <ul className="space-y-1 text-sm">
                {(live.participants || []).map(p => (
                  <li key={p.socketId || p.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-2 py-1">
                    <span>{p.name}</span>
                    <button type="button" onClick={() => removeSock(p.socketId || p.id)} className="text-red-500 text-xs">Remove</button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Recent chat</p>
              <div className="max-h-48 overflow-y-auto text-xs space-y-1 bg-gray-50 rounded-lg p-2">
                {(live.chatTail || []).map(m => (
                  <p key={m.id}><span className="font-medium text-gray-700">{m.user || m.type}:</span> {m.content}</p>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
      {liveId && !live?.live && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">No in-memory session for this room (participants may be offline). MongoDB row still listed below.</p>
      )}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs uppercase text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 w-8"></th>
                <th className="px-4 py-3">Room Name</th>
                <th className="px-4 py-3">Creator</th>
                <th className="px-4 py-3">Participants</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">Loading…</td></tr>
              ) : rooms.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">No rooms found</td></tr>
              ) : rooms.map(r => (
                <React.Fragment key={r._id}>
                  <tr className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setExpandedRoom(expandedRoom === r._id ? null : r._id)}
                        className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-200 transition-colors"
                      >
                        <i className={`ri-chevron-${expandedRoom === r._id ? 'down' : 'right'}-line text-gray-600`} />
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{r.createdBy?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full text-xs font-medium">
                        <i className="ri-group-line" />
                        {r.participants?.length ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${
                        r.status === 'active' ? 'bg-green-100 text-green-700' :
                        r.status === 'completed' ? 'bg-gray-100 text-gray-700' :
                        r.status === 'scheduled' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{r.duration ? `${r.duration}m` : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setSelectedDetailRoom(r)} className="text-blue-600 hover:text-blue-700 text-xs font-medium">Details</button>
                        {r.status === 'active' && (
                          <button type="button" onClick={() => endAdminRoom(r._id).then(fetchRooms)} className="text-orange-600 hover:text-orange-700 text-xs font-medium">End</button>
                        )}
                        <button type="button" onClick={() => deleteAdminRoom(r._id).then(fetchRooms)} className="text-red-600 hover:text-red-700 text-xs font-medium">Delete</button>
                        <button type="button" onClick={() => setLiveId(r._id)} className="text-indigo-600 hover:text-indigo-700 text-xs font-medium">Monitor</button>
                      </div>
                    </td>
                  </tr>
                  {expandedRoom === r._id && (
                    <tr className="border-t border-gray-50 bg-gray-50/50">
                      <td colSpan={8} className="px-4 py-4">
                        <div className="space-y-4">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">Participants Details</h4>
                            {r.participants && r.participants.length > 0 ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {r.participants.map((p, idx) => (
                                  <div key={p._id} className="bg-white border border-gray-200 rounded-lg p-3">
                                    <p className="font-medium text-gray-900 text-sm">{idx + 1}. {p.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{p.email}</p>
                                    <div className="flex gap-1 mt-2">
                                      <span className="inline-flex items-center gap-0.5 bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs">
                                        <i className="ri-check-line" /> Attended
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">No participants</p>
                            )}
                          </div>
                          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-gray-200">
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <p className="text-xs text-gray-500 uppercase font-semibold">AI Requests</p>
                              <p className="text-lg font-bold text-indigo-600 mt-1">—</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <p className="text-xs text-gray-500 uppercase font-semibold">Quizzes</p>
                              <p className="text-lg font-bold text-purple-600 mt-1">—</p>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <p className="text-xs text-gray-500 uppercase font-semibold">Resources</p>
                              <p className="text-lg font-bold text-amber-600 mt-1">—</p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-600 py-1">{page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40">Next</button>
        </div>
      )}

      {selectedDetailRoom && (
        <div className="fixed inset-0 bg-black/45 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <Card className="w-full max-w-3xl my-2">
            <div className="flex justify-between items-start border-b border-gray-200 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{selectedDetailRoom.name}</h2>
                <p className="text-xs text-gray-500">Room details</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetailRoom(null)}
                className="text-gray-500 hover:text-gray-700 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                ['Status', selectedDetailRoom.status || '—'],
                ['Creator', selectedDetailRoom.createdBy?.name || '—'],
                ['Creator Email', selectedDetailRoom.createdBy?.email || '—'],
                ['Subject', selectedDetailRoom.subject || 'General'],
                ['Duration', `${selectedDetailRoom.duration || 0} minutes`],
                ['Created Date', selectedDetailRoom.createdAt ? `${new Date(selectedDetailRoom.createdAt).toLocaleDateString()} ${new Date(selectedDetailRoom.createdAt).toLocaleTimeString()}` : '—'],
                ['Capacity', `${selectedDetailRoom.maxParticipants || 0} max`],
              ].map(([label, value], idx) => (
                <div key={label} className="grid grid-cols-[110px,1fr] gap-2 px-3 py-2 text-xs border border-gray-200 rounded-md">
                  <p className="text-gray-500">{label}</p>
                  <p className="text-gray-900 font-medium break-words">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-900">Participants ({selectedDetailRoom.participants?.length || 0})</h3>
              {selectedDetailRoom.participants && selectedDetailRoom.participants.length > 0 ? (
                <div className="mt-2 border border-gray-200 rounded-md overflow-hidden max-h-36 overflow-y-auto">
                  {selectedDetailRoom.participants.map((participant, idx) => (
                    <div key={participant._id || `${participant.email}-${idx}`} className={`px-3 py-2 ${idx !== 0 ? 'border-t border-gray-200' : ''}`}>
                      <p className="text-sm font-medium text-gray-900">{participant.name || 'Unknown'}</p>
                      <p className="text-xs text-gray-500">{participant.email || 'No email'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-gray-500">No participants in this room.</p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDetailRoom(null)}
                className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

/* ─── Resources ─── */
export function AdminResourcesView() {
  const [resources, setResources] = useState([])
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await getAdminResources({ page, search, subject, limit: 15 })
      if (d.ok) { setResources(d.resources); setPages(d.pages) }
    } catch { /* */ }
    setLoading(false)
  }, [page, search, subject])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Resources</h1>
      <div className="flex flex-wrap gap-2">
        <input className="border rounded-xl px-3 py-2 text-sm flex-1 min-w-[120px]" placeholder="Search" value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
        <input className="border rounded-xl px-3 py-2 text-sm w-40" placeholder="Subject filter" value={subject} onChange={e => { setSubject(e.target.value); setPage(1) }} />
      </div>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">DL</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-10 text-center">Loading…</td></tr>
            ) : resources.map(r => (
              <tr key={r._id} className="border-t border-gray-50">
                <td className="px-4 py-3">{r.title}</td>
                <td className="px-4 py-3 text-xs">{r.subject || '—'}</td>
                <td className="px-4 py-3">{r.downloads ?? 0}</td>
                <td className="px-4 py-3">{r.rating ?? 0}</td>
                <td className="px-4 py-3">
                  <button type="button" onClick={() => toggleAdminResourceFeatured(r._id).then(load)} className="text-amber-600 text-xs mr-2">{r.featured ? 'Unfeature' : 'Feature'}</button>
                  <button type="button" onClick={() => deleteAdminResource(r._id).then(load)} className="text-red-500 text-xs">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {pages > 1 && (
        <div className="flex justify-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded-lg text-sm">Prev</button>
          <span className="text-sm py-1">{page}/{pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded-lg text-sm">Next</button>
        </div>
      )}
    </div>
  )
}

/* ─── AI usage ─── */
export function AdminAIUsageView() {
  const [data, setData] = useState(null)
  useEffect(() => {
    getAdminAiUsageSummary().then(d => { if (d.ok) setData(d) }).catch(() => {})
  }, [])

  if (!data) return <div className="py-20 text-center">Loading…</div>

  const feat = (data.byFeature || []).map(f => ({ name: f._id || 'unknown', requests: f.requests, tokens: f.tokens }))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">AI usage</h1>
      <Card>
        <h3 className="text-sm font-semibold mb-3">Requests by feature</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={feat} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="requests" fill="#8b5cf6" name="Requests" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <h3 className="text-sm font-semibold mb-2">Top users</h3>
        <ul className="text-sm space-y-2 max-h-96 overflow-y-auto">
          {(data.byUser || []).map(row => (
            <li key={row._id} className="flex justify-between border-b border-gray-50 pb-2">
              <span>{row.user?.name || row._id}</span>
              <span className="text-gray-500">{row.requests} requests · ~{row.tokens} tok</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ─── Analytics ─── */
export function AdminAnalyticsView() {
  const [d, setD] = useState(null)
  useEffect(() => {
    getAdminAnalyticsAdvanced().then(x => { if (x.ok) setD(x) })
  }, [])

  if (!d) return <div className="py-20 text-center">Loading…</div>

  const subs = (d.mostStudiedSubjects || []).map(s => ({ name: s.subject, minutes: s.minutes }))

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Advanced analytics</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard icon="ri-user-follow-line" label="Rolling engagement" value={d.retention?.matureUsersWithActivityLast30dPercent != null ? `${d.retention.matureUsersWithActivityLast30dPercent}%` : '—'} color="#6366f1" sub={d.retention?.note} />
        <StatCard icon="ri-user-unfollow-line" label="Churn (approx)" value={`${d.churn?.ratePercentLast30vsPrior30 ?? 0}%`} color="#f43f5e" sub={`Prior active: ${d.churn?.priorActiveUsers ?? 0}`} />
        <StatCard icon="ri-bar-chart-line" label="Avg study hours / user" value={d.avgStudyHoursPerUser} color="#14b8a6" />
      </div>
      <Card>
        <h3 className="text-sm font-semibold mb-3">Most studied subjects (completed sessions)</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subs}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="minutes" fill="#F2CF7E" name="Minutes" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  )
}

/* ─── Reports (admin) ─── */
export function AdminReportsView() {
  const [userId, setUserId] = useState('')
  const [reports, setReports] = useState([])
  const [userDetail, setUserDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  const isMongoObjectId = (value) => /^[a-f\d]{24}$/i.test(value)

  const normalizeReport = (report) => ({
    ...report,
    _id: report?._id || report?.id,
    createdAt: report?.createdAt || report?.generatedAt || new Date().toISOString(),
  })

  const load = async () => {
    const trimmed = userId.trim()
    setHasSearched(true)
    setError('')
    setMessage('')
    if (!trimmed) {
      setReports([])
      setUserDetail(null)
      setError('Please enter a user id.')
      return
    }
    if (!isMongoObjectId(trimmed)) {
      setReports([])
      setUserDetail(null)
      setError('Please enter a valid Mongo ObjectId (24 hex characters).')
      return
    }

    setLoading(true)
    try {
      const [reportsRes, detailRes] = await Promise.all([
        getReportsForUser(trimmed),
        getAdminUserDetail(trimmed),
      ])

      if (reportsRes.ok) setReports((reportsRes.reports || []).map(normalizeReport))
      else setReports([])

      if (detailRes.ok) setUserDetail(detailRes)
      else setUserDetail(null)
    } catch (e) {
      setReports([])
      setUserDetail(null)
      setError(e?.message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    const trimmed = userId.trim()
    setError('')
    setMessage('')
    if (!trimmed) {
      setError('Please enter a user id.')
      return
    }
    if (!isMongoObjectId(trimmed)) {
      setError('Please enter a valid Mongo ObjectId (24 hex characters).')
      return
    }

    setGenerating(true)
    try {
      const d = await adminGenerateReportForUser(trimmed, { rangeDays: 30, format: 'pdf' })
      if (d.ok) {
        if (d.report) {
          setReports(prev => {
            const next = [normalizeReport(d.report), ...prev]
            const seen = new Set()
            return next.filter(r => {
              const key = r._id
              if (!key || seen.has(key)) return false
              seen.add(key)
              return true
            })
          })
        }
        setHasSearched(true)
        setMessage('Report generated successfully.')
        await load()
      }
    } catch (e) {
      setError(e?.message || 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">User reports</h1>
      <Card className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">User ID</label>
          <input
            className="border rounded-xl px-3 py-2 text-sm w-72"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') load() }}
            placeholder="Mongo ObjectId"
          />
        </div>
        <button type="button" onClick={load} disabled={loading || generating} className="px-4 py-2 rounded-xl bg-[#F2CF7E] text-black text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
          {loading ? 'Loading...' : 'Load'}
        </button>
        <button type="button" onClick={generateReport} disabled={loading || generating} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed">
          {generating ? 'Generating...' : 'Generate report'}
        </button>
      </Card>
      {message && (
        <Card>
          <p className="text-sm text-green-700">{message}</p>
        </Card>
      )}
      {error && (
        <Card>
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}
      {userDetail?.activity && (
        <>
          <Card>
            <h2 className="text-lg font-semibold text-gray-900">{userDetail.user?.name || 'User'}</h2>
            <p className="text-sm text-gray-600">{userDetail.user?.email || 'No email available'}</p>
            <p className="text-xs text-gray-500 mt-1">Period: {userDetail.activity?.period?.start} to {userDetail.activity?.period?.end}</p>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon="ri-time-line" label="Study hours (30d)" value={userDetail.activity?.studyHoursLast30d ?? 0} color="#14b8a6" />
            <StatCard icon="ri-trophy-line" label="Total XP" value={userDetail.user?.totalXP ?? 0} color="#f59e0b" />
            <StatCard icon="ri-calendar-check-line" label="Rooms created" value={userDetail.activity?.roomsCreated ?? 0} color="#10b981" />
            <StatCard icon="ri-team-line" label="Rooms joined" value={userDetail.activity?.roomsJoined ?? 0} color="#6366f1" />
          </div>

          <Card>
            <h3 className="text-sm font-semibold mb-2">Subject distribution</h3>
            {userDetail.activity?.subjectDistribution?.length ? (
              <ul className="text-sm space-y-1 text-gray-700">
                {userDetail.activity.subjectDistribution.map((s) => (
                  <li key={s.name}>{s.name}: {s.percent}% ({Number(s.hours || 0).toFixed(1)} h)</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No subject distribution data yet.</p>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold mb-2">AI usage by feature</h3>
            {userDetail.activity?.aiUsageByFeature?.length ? (
              <ul className="text-sm space-y-1 text-gray-700">
                {userDetail.activity.aiUsageByFeature.map((a) => (
                  <li key={a.feature}>{a.feature}: {a.requests} requests (~{a.tokensEstimate || 0} tokens)</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No AI usage in selected range.</p>
            )}
          </Card>

          <Card>
            <h3 className="text-sm font-semibold mb-2">AI insights</h3>
            {reports[0]?.aiInsights?.length ? (
              <ul className="text-sm space-y-1 text-gray-700 list-disc pl-5">
                {reports[0].aiInsights.map((line, idx) => (
                  <li key={`${idx}-${line}`}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Generate a report to view AI insights.</p>
            )}
          </Card>
        </>
      )}
      <Card>
        <ul className="text-sm space-y-2">
          {!loading && hasSearched && !error && reports.length === 0 && (
            <li className="py-2 text-gray-500">No reports found for this user.</li>
          )}
          {reports.map(r => (
            <li key={r._id || r.id} className="flex justify-between items-center border-b border-gray-50 py-2">
              <span>{new Date(r.createdAt).toLocaleString()} — {r.format} — {r.status}</span>
              {r.status === 'completed' && (r._id || r.id) && (
                <button type="button" className="text-indigo-600 text-xs font-medium" onClick={() => downloadReportBlob(r._id || r.id, `report.${r.format === 'json' ? 'json' : 'pdf'}`)}>Download</button>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/* ─── Notifications ─── */
export function AdminNotificationsView() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targets, setTargets] = useState('')
  const [msg, setMsg] = useState('')

  const send = async (global) => {
    setMsg('')
    try {
      const userIds = targets.split(',').map(s => s.trim()).filter(Boolean)
      const d = await broadcastAdminNotification({
        title,
        message,
        broadcastAll: global,
        userIds: global ? undefined : userIds,
      })
      if (d.ok) setMsg(`Sent to ${d.sent} users`)
    } catch (e) { setMsg(e.message) }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-bold">Notifications</h1>
      <Card className="space-y-3">
        <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
        <textarea className="w-full border rounded-xl px-3 py-2 text-sm" rows={4} placeholder="Message" value={message} onChange={e => setMessage(e.target.value)} />
        <input className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Target user IDs (comma-separated), empty = all users" value={targets} onChange={e => setTargets(e.target.value)} />
        <div className="flex gap-2">
          <button type="button" onClick={() => send(false)} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm">Send targeted</button>
          <button type="button" onClick={() => send(true)} className="px-4 py-2 rounded-xl bg-[#F2CF7E] text-black text-sm font-semibold">Broadcast all</button>
        </div>
        {msg && <p className="text-sm text-green-600">{msg}</p>}
      </Card>
    </div>
  )
}

/* ─── Moderation ─── */
export function AdminModerationView() {
  const [cases, setCases] = useState([])
  const [scan, setScan] = useState('')
  const [scanRes, setScanRes] = useState(null)

  const load = useCallback(() => {
    getAdminModerationCases().then(d => { if (d.ok) setCases(d.cases || []) })
  }, [])

  useEffect(() => { load() }, [load])

  const resolve = (id, status) => {
    updateAdminModerationCase(id, { status }).then(load)
  }

  const runScan = () => {
    scanAdminSpam(scan).then(setScanRes).catch(() => {})
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Moderation</h1>
      <Card>
        <h3 className="text-sm font-semibold mb-2">Spam heuristic</h3>
        <textarea className="w-full border rounded-xl p-2 text-sm mb-2" rows={3} value={scan} onChange={e => setScan(e.target.value)} />
        <button type="button" onClick={runScan} className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm">Scan</button>
        {scanRes && <p className="text-sm mt-2 text-gray-600">Score {scanRes.spamScore} {scanRes.flagged ? '(flagged)' : ''}</p>}
      </Card>
      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Target</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cases.map(c => (
              <tr key={c._id} className="border-t border-gray-50">
                <td className="px-4 py-2">{c.type}</td>
                <td className="px-4 py-2 text-xs">{c.targetUserId?.name || '—'}</td>
                <td className="px-4 py-2">{c.status}</td>
                <td className="px-4 py-2 space-x-1">
                  <button type="button" className="text-xs text-amber-700" onClick={() => resolve(c._id, 'warned')}>Warn</button>
                  <button type="button" className="text-xs text-red-600" onClick={() => resolve(c._id, 'banned')}>Ban case</button>
                  <button type="button" className="text-xs text-gray-600" onClick={() => resolve(c._id, 'dismissed')}>Dismiss</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  )
}

/* ─── Gamification ─── */
export function AdminGamificationView() {
  const [settings, setSettings] = useState(null)
  const [badge, setBadge] = useState({ name: '', description: '', icon: 'ri-award-line' })

  const load = () => getAdminGamification().then(d => { if (d.ok) setSettings(d.settings) })

  useEffect(() => { load() }, [])

  if (!settings) return <div className="py-20 text-center">Loading…</div>

  const save = () => {
    putAdminGamification(settings).then(load)
  }

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-xl font-bold">Gamification</h1>
      <Card className="space-y-3">
        <label className="text-xs text-gray-500">XP per study hour</label>
        <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={settings.xpPerStudyHour} onChange={e => setSettings(s => ({ ...s, xpPerStudyHour: Number(e.target.value) }))} />
        <label className="text-xs text-gray-500">XP per room join</label>
        <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={settings.xpPerRoomJoin} onChange={e => setSettings(s => ({ ...s, xpPerRoomJoin: Number(e.target.value) }))} />
        <label className="text-xs text-gray-500">XP per resource upload</label>
        <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={settings.xpPerResourceUpload} onChange={e => setSettings(s => ({ ...s, xpPerResourceUpload: Number(e.target.value) }))} />
        <button type="button" onClick={save} className="px-4 py-2 rounded-xl bg-[#F2CF7E] text-black font-semibold text-sm">Save rules</button>
      </Card>
      <Card>
        <h3 className="font-semibold text-sm mb-2">Add custom badge</h3>
        <input className="w-full border rounded-lg px-3 py-2 text-sm mb-2" placeholder="Name" value={badge.name} onChange={e => setBadge(b => ({ ...b, name: e.target.value }))} />
        <input className="w-full border rounded-lg px-3 py-2 text-sm mb-2" placeholder="Description" value={badge.description} onChange={e => setBadge(b => ({ ...b, description: e.target.value }))} />
        <button
          type="button"
          onClick={() => postAdminGamificationBadge(badge).then(load)}
          className="px-3 py-2 bg-gray-900 text-white rounded-lg text-sm"
        >
          Add badge
        </button>
        <ul className="mt-3 text-xs text-gray-600 space-y-1">
          {(settings.customBadges || []).map(b => (
            <li key={b.id}>{b.name}: {b.description}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <h3 className="font-semibold text-sm mb-2">XP leaderboard</h3>
        <XpLeaderboardInline />
      </Card>
    </div>
  )
}

function XpLeaderboardInline() {
  const [rows, setRows] = useState([])
  useEffect(() => {
    getAdminXpLeaderboard().then(d => { if (d.ok) setRows(d.leaderboard || []) })
  }, [])
  return (
    <ol className="text-sm max-h-64 overflow-y-auto space-y-1">
      {rows.map(r => (
        <li key={r._id} className="flex justify-between">
          <span>#{r.rank} {r.name}</span>
          <span className="text-indigo-600">{r.totalXP} XP</span>
        </li>
      ))}
    </ol>
  )
}

/* ─── Settings ─── */
export function AdminSettingsView() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-xl font-bold">Settings</h1>
      <Card>
        <h3 className="font-semibold text-gray-800 mb-2">Promote to admin</h3>
        <form
          onSubmit={async e => {
            e.preventDefault()
            setMsg('')
            try {
              const d = await promoteToAdmin(email)
              if (d.ok) setMsg(`Promoted ${d.user.email}`)
            } catch (err) { setMsg(err.message) }
          }}
          className="flex gap-2"
        >
          <input type="email" required className="flex-1 border rounded-xl px-3 py-2 text-sm" value={email} onChange={e => setEmail(e.target.value)} />
          <button type="submit" className="px-4 py-2 bg-[#F2CF7E] rounded-xl text-sm font-semibold">Promote</button>
        </form>
        {msg && <p className="text-sm mt-2 text-green-600">{msg}</p>}
      </Card>
    </div>
  )
}
