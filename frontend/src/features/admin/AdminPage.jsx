import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../lib/auth'
import { useNavigate } from 'react-router-dom'
import {
  getAdminDashboard,
  getAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  getAdminResources,
  deleteAdminResource,
  toggleAdminResourceFeatured,
  getAdminRooms,
  deleteAdminRoom,
  endAdminRoom,
  promoteToAdmin,
} from '../../lib/api'

// ─── Mini chart components ────────────────────
function BarChart({ data, label, color = '#F2CF7E', height = 160 }) {
  const max = Math.max(...data.map(d => d.count), 1)
  return (
    <div className="w-full">
      <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">{label}</p>
      <div className="flex items-end gap-[2px] sm:gap-1" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 group relative flex flex-col items-center justify-end h-full">
            <div
              className="w-full rounded-t-sm transition-all duration-300 min-h-[2px]"
              style={{
                height: `${Math.max(2, (d.count / max) * 100)}%`,
                background: `linear-gradient(to top, ${color}, ${color}cc)`,
                opacity: 0.85 + (d.count / max) * 0.15,
              }}
            />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              {d.date}: {d.count}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-gray-400">{data[0]?.date?.slice(5)}</span>
        <span className="text-[9px] text-gray-400">{data[data.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  )
}

function DonutChart({ data, size = 140 }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1
  const colors = ['#F2CF7E', '#6366f1', '#14b8a6', '#f97316', '#f43f5e', '#8b5cf6', '#06b6d4', '#eab308']
  let accumulated = 0
  const r = size / 2 - 10
  const cx = size / 2
  const cy = size / 2

  function describeArc(startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle)
    const end = polarToCartesian(cx, cy, r, startAngle)
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1'
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
  }

  function polarToCartesian(cx, cy, r, deg) {
    const rad = ((deg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  }

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          const angle = (d.count / total) * 360
          const startAngle = accumulated
          accumulated += angle
          if (angle < 0.5) return null
          return (
            <path
              key={i}
              d={describeArc(startAngle, startAngle + angle - 1)}
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth={20}
              strokeLinecap="round"
            />
          )
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" className="text-lg font-bold fill-gray-800">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="text-[10px] fill-gray-500">total</text>
      </svg>
      <div className="flex flex-col gap-1 text-xs">
        {data.slice(0, 6).map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
            <span className="text-gray-700 capitalize truncate max-w-[100px]">{d._id || 'Other'}</span>
            <span className="text-gray-400 ml-auto">{d.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color = '#F2CF7E', sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 flex items-start gap-3 sm:gap-4 shadow-sm hover:shadow-md transition-shadow">
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}22` }}
      >
        <i className={`${icon} text-xl`} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Tab content components ────────────────────

function DashboardTab({ dashboard }) {
  if (!dashboard) return <Loading />
  const { stats, charts, topUsers, recentUsers } = dashboard
  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatCard icon="ri-user-line" label="Total Users" value={stats.totalUsers} color="#6366f1" sub={`+${stats.newUsersLast30} this month`} />
        <StatCard icon="ri-video-chat-line" label="Total Rooms" value={stats.totalRooms} color="#f97316" />
        <StatCard icon="ri-live-line" label="Active Rooms" value={stats.activeRooms} color="#22c55e" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
          <BarChart data={charts.userSignups} label="User Signups (30d)" color="#6366f1" />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
          <BarChart data={charts.roomCreations} label="Rooms Created (30d)" color="#f97316" />
        </div>
      </div>

      {/* Donut chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Room Status Breakdown</p>
          <DonutChart data={charts.roomsByStatus} />
        </div>
      </div>

      {/* Top Users & Recent Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Top Users by XP</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {topUsers.map((u, i) => (
              <div key={u._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i < 3 ? 'bg-[#F2CF7E] text-black' : 'bg-gray-100 text-gray-600'}`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center overflow-hidden shrink-0">
                  {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-white text-xs font-bold">{u.name?.[0]?.toUpperCase()}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-indigo-600">{u.totalXP} XP</p>
                  <p className="text-[10px] text-gray-400">{u.totalStudyHours}h • 🔥{u.currentStreak}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5 shadow-sm">
          <p className="text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">Recent Signups</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentUsers.map(u => (
              <div key={u._id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center overflow-hidden shrink-0">
                  {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-white text-xs font-bold">{u.name?.[0]?.toUpperCase()}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.role}
                  </span>
                  <p className="text-[10px] text-gray-400 mt-0.5">{new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function UsersTab() {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [editRole, setEditRole] = useState('')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminUsers({ page, search, role: roleFilter, limit: 15 })
      if (data.ok) {
        setUsers(data.users)
        setTotal(data.total)
        setPages(data.pages)
      }
    } catch {}
    setLoading(false)
  }, [page, search, roleFilter])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) return
    try {
      await deleteAdminUser(id)
      fetchUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleRoleUpdate = async (id) => {
    try {
      await updateAdminUser(id, { role: editRole })
      setEditingId(null)
      fetchUsers()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search users by name or email..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F2CF7E] focus:border-transparent transition-all"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1) }}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2CF7E]"
        >
          <option value="">All Roles</option>
          <option value="user">Users</option>
          <option value="admin">Admins</option>
        </select>
      </div>

      <p className="text-xs text-gray-500">{total} users found</p>

      {/* Users table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden sm:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Institution</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Role</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">XP</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Joined</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400"><i className="ri-loader-4-line animate-spin text-xl" /> Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No users found</td></tr>
              ) : users.map(u => (
                <tr key={u._id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center overflow-hidden shrink-0">
                        {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : <span className="text-white text-xs font-bold">{u.name?.[0]?.toUpperCase()}</span>}
                      </div>
                      <span className="font-medium text-gray-800 truncate max-w-[120px]">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell truncate max-w-[180px]">{u.email}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell truncate max-w-[120px]">{u.institution || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    {editingId === u._id ? (
                      <div className="flex items-center justify-center gap-1">
                        <select value={editRole} onChange={e => setEditRole(e.target.value)} className="text-xs border rounded px-1 py-0.5">
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                        <button onClick={() => handleRoleUpdate(u._id)} className="text-green-600 hover:text-green-700"><i className="ri-check-line" /></button>
                        <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600"><i className="ri-close-line" /></button>
                      </div>
                    ) : (
                      <span
                        onClick={() => { setEditingId(u._id); setEditRole(u.role || 'user') }}
                        className={`cursor-pointer text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${u.role === 'admin' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {u.role || 'user'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-600 font-medium">{u.totalXP || 0}</td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(u._id, u.name)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors mx-auto"
                      title="Delete user"
                    >
                      <i className="ri-delete-bin-6-line text-sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors">
            <i className="ri-arrow-left-s-line" />
          </button>
          <span className="text-sm text-gray-600">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors">
            <i className="ri-arrow-right-s-line" />
          </button>
        </div>
      )}
    </div>
  )
}

function ResourcesTab() {
  const [resources, setResources] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchResources = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminResources({ page, search, limit: 15 })
      if (data.ok) {
        setResources(data.resources)
        setTotal(data.total)
        setPages(data.pages)
      }
    } catch {}
    setLoading(false)
  }, [page, search])

  useEffect(() => { fetchResources() }, [fetchResources])

  const handleDelete = async (id, title) => {
    if (!confirm(`Delete resource "${title}"?`)) return
    try {
      await deleteAdminResource(id)
      fetchResources()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleToggleFeatured = async (id) => {
    try {
      await toggleAdminResourceFeatured(id)
      fetchResources()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search resources..."
          className="w-full sm:w-80 pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F2CF7E] focus:border-transparent transition-all"
        />
      </div>

      <p className="text-xs text-gray-500">{total} resources found</p>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Title</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden sm:table-cell">Category</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Contributor</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Downloads</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Featured</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Date</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400"><i className="ri-loader-4-line animate-spin text-xl" /> Loading...</td></tr>
              ) : resources.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No resources found</td></tr>
              ) : resources.map(r => (
                <tr key={r._id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <i className={`${r.icon || 'ri-file-line'} text-base`} />
                      <span className="font-medium text-gray-800 truncate max-w-[200px]">{r.title}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full capitalize">{r.category}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell truncate max-w-[120px]">{r.contributorName || '—'}</td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-600">{r.downloads || 0}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleToggleFeatured(r._id)}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors mx-auto ${r.featured ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-50'}`}
                      title={r.featured ? 'Remove featured' : 'Mark featured'}
                    >
                      <i className={r.featured ? 'ri-star-fill' : 'ri-star-line'} />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-500 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleDelete(r._id, r.title)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors mx-auto"
                      title="Delete resource"
                    >
                      <i className="ri-delete-bin-6-line text-sm" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors">
            <i className="ri-arrow-left-s-line" />
          </button>
          <span className="text-sm text-gray-600">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors">
            <i className="ri-arrow-right-s-line" />
          </button>
        </div>
      )}
    </div>
  )
}

function RoomsTab() {
  const [rooms, setRooms] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchRooms = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAdminRooms({ page, status: statusFilter, limit: 15 })
      if (data.ok) {
        setRooms(data.rooms)
        setTotal(data.total)
        setPages(data.pages)
      }
    } catch {}
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => { fetchRooms() }, [fetchRooms])

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete room "${name}" and its archive?`)) return
    try {
      await deleteAdminRoom(id)
      fetchRooms()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleEnd = async (id) => {
    if (!confirm('Force end this room?')) return
    try {
      await endAdminRoom(id)
      fetchRooms()
    } catch (err) {
      alert(err.message)
    }
  }

  const statusColors = {
    active: 'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600',
    scheduled: 'bg-blue-100 text-blue-700',
    cancelled: 'bg-red-100 text-red-600',
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 sm:gap-3">
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#F2CF7E]"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="scheduled">Scheduled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <p className="text-xs text-gray-500">{total} rooms found</p>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80">
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Room</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden sm:table-cell">Subject</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden md:table-cell">Creator</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Participants</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide hidden lg:table-cell">Created</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400"><i className="ri-loader-4-line animate-spin text-xl" /> Loading...</td></tr>
              ) : rooms.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No rooms found</td></tr>
              ) : rooms.map(r => (
                <tr key={r._id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-800 truncate max-w-[200px] block">{r.name}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell truncate max-w-[120px]">{r.subject || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{r.createdBy?.name || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[r.status] || 'bg-gray-100 text-gray-600'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-600">{r.maxParticipants || 0}</td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell text-gray-500 text-xs">{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {r.status === 'active' && (
                        <button
                          onClick={() => handleEnd(r._id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                          title="Force end room"
                        >
                          <i className="ri-stop-circle-line text-sm" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(r._id, r.name)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete room"
                      >
                        <i className="ri-delete-bin-6-line text-sm" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors">
            <i className="ri-arrow-left-s-line" />
          </button>
          <span className="text-sm text-gray-600">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 text-sm bg-white border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors">
            <i className="ri-arrow-right-s-line" />
          </button>
        </div>
      )}
    </div>
  )
}

function SettingsTab() {
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const handlePromote = async (e) => {
    e.preventDefault()
    setMsg('')
    setErr('')
    try {
      const data = await promoteToAdmin(email)
      if (data.ok) {
        setMsg(`${data.user.name} (${data.user.email}) promoted to admin!`)
        setEmail('')
      }
    } catch (error) {
      setErr(error.message)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-1">Promote User to Admin</h3>
        <p className="text-sm text-gray-500 mb-4">Grant admin privileges to a user by their email address.</p>
        <form onSubmit={handlePromote} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#F2CF7E] focus:border-transparent"
          />
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#F2CF7E] text-black rounded-xl text-sm font-semibold hover:bg-[#e0bd6c] transition-colors shadow-sm"
          >
            Promote
          </button>
        </form>
        {msg && <p className="text-sm text-green-600 mt-3 flex items-center gap-1"><i className="ri-check-line" /> {msg}</p>}
        {err && <p className="text-sm text-red-500 mt-3 flex items-center gap-1"><i className="ri-error-warning-line" /> {err}</p>}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-1">Admin Panel Info</h3>
        <p className="text-sm text-gray-500 mb-3">This admin panel gives you full access to manage all application resources.</p>
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center gap-2"><i className="ri-dashboard-line text-indigo-500" /> Dashboard analytics & charts</div>
          <div className="flex items-center gap-2"><i className="ri-user-settings-line text-teal-500" /> User management & role control</div>
          <div className="flex items-center gap-2"><i className="ri-folder-settings-line text-orange-500" /> Resource management & featuring</div>
          <div className="flex items-center gap-2"><i className="ri-video-chat-line text-purple-500" /> Room management & force-end</div>
          <div className="flex items-center gap-2"><i className="ri-shield-check-line text-amber-500" /> Admin privilege management</div>
        </div>
      </div>
    </div>
  )
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-3 border-[#F2CF7E] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500">Loading admin data...</p>
      </div>
    </div>
  )
}

// ─── Main admin page ────────────────────
const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: 'ri-dashboard-line' },
  { id: 'users', label: 'Users', icon: 'ri-user-line' },
  { id: 'rooms', label: 'Rooms', icon: 'ri-video-chat-line' },
  { id: 'settings', label: 'Settings', icon: 'ri-settings-3-line' },
]

export default function AdminPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [dashboard, setDashboard] = useState(null)
  const [loadError, setLoadError] = useState('')

  // Guard: only admin can access
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/', { replace: true })
    }
  }, [user, navigate])

  // Fetch dashboard data on mount
  useEffect(() => {
    if (user?.role !== 'admin') return
    getAdminDashboard()
      .then(data => { if (data.ok) setDashboard(data) })
      .catch(err => setLoadError(err.message))
  }, [user])

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <i className="ri-shield-keyhole-line text-5xl text-gray-300 mb-3 block" />
          <h2 className="text-lg font-semibold text-gray-700">Access Denied</h2>
          <p className="text-sm text-gray-500 mt-1">You don't have admin privileges.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <i className="ri-shield-star-line text-[#F2CF7E]" />
            Admin Panel
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your application resources and monitor activity</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">{user.name?.[0]?.toUpperCase()}</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-800">{user.name}</p>
            <p className="text-[10px] text-amber-600 font-semibold uppercase tracking-wider">Admin</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-white rounded-xl border border-gray-100 p-1 shadow-sm overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-[#F2CF7E] text-black shadow-sm'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <i className={`${tab.icon} text-base`} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-600 flex items-center gap-2">
          <i className="ri-error-warning-line text-lg" />
          {loadError}
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'dashboard' && <DashboardTab dashboard={dashboard} />}
      {activeTab === 'users' && <UsersTab />}
      {activeTab === 'resources' && <ResourcesTab />}
      {activeTab === 'rooms' && <RoomsTab />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  )
}
