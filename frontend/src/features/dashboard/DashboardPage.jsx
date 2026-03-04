import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { getDashboardSummary } from '../../lib/api'
import { getUserRoomStats } from '../../lib/roomApiV2'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [activeRooms, setActiveRooms] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [studyProgressData, setStudyProgressData] = useState([])
  const [subjectData, setSubjectData] = useState([])
  const [totalHours, setTotalHours] = useState(0)
  const [totalSessions, setTotalSessions] = useState(0)

  useEffect(() => {
    let mounted = true
    const loadData = async () => {
      setLoading(true)
      try {
        const [dashData, roomStats] = await Promise.all([
          getDashboardSummary().catch(() => null),
          getUserRoomStats().catch(() => null),
        ])

        if (!mounted) return

        // Load room statistics
        if (roomStats) {
          setActiveRooms((roomStats.activeSessions || []).slice(0, 5).map(r => ({
            id: r._id,
            name: r.name,
            participants: r.participants?.length || 0,
          })))
          
          setRecentSessions((roomStats.recentSessions || []).slice(0, 5).map(r => ({
            id: r._id,
            name: r.name,
            duration: r.duration ? `${Math.round(r.duration)} min` : 'N/A',
            time: r.endedAt ? new Date(r.endedAt).toLocaleString() : 'Recently',
          })))
          
          setUpcomingSessions((roomStats.upcomingSessions || []).slice(0, 5).map(r => ({
            id: r._id,
            name: r.name,
            time: r.scheduledFor ? new Date(r.scheduledFor).toLocaleString() : 'Soon',
          })))
          
          setTotalHours(roomStats.totalHours || 0)
          setTotalSessions(roomStats.totalSessions || 0)
          
          // Subject distribution from room stats
          if (roomStats.subjectDistribution && Object.keys(roomStats.subjectDistribution).length > 0) {
            const subjectColors = ['#6366f1', '#14b8a6', '#f97316', '#f43f5e', '#8b5cf6', '#06b6d4', '#eab308', '#ec4899']
            const totalMinutes = Object.values(roomStats.subjectDistribution).reduce((a, b) => a + b, 0) || 1
            const subjects = Object.entries(roomStats.subjectDistribution).map(([name, minutes], i) => ({
              name,
              value: Math.max(1, Math.round((minutes / totalMinutes) * 100)),
              color: subjectColors[i % subjectColors.length],
            }))
            setSubjectData(subjects)
          }
        }

        // Load dashboard data (for study progress chart)
        if (dashData?.ok) {
          setStudyProgressData(dashData.studyProgress || [])
          // If no subject data from rooms, use dashboard data
          if (!(roomStats?.subjectDistribution && Object.keys(roomStats.subjectDistribution).length > 0) && dashData.subjectDistribution?.length > 0) {
            setSubjectData(dashData.subjectDistribution)
          }
        }
      } catch (err) {
        console.error('Dashboard load error:', err)
      }
      if (mounted) setLoading(false)
    }
    loadData()
    return () => { mounted = false }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
              <i className="ri-time-line text-2xl text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Study Time</p>
              <p className="text-2xl font-bold text-gray-900">{totalHours}h</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <i className="ri-video-chat-line text-2xl text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Sessions</p>
              <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <i className="ri-live-line text-2xl text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Now</p>
              <p className="text-2xl font-bold text-gray-900">{activeRooms.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
              <i className="ri-calendar-line text-2xl text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Upcoming</p>
              <p className="text-2xl font-bold text-gray-900">{upcomingSessions.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
        {/* Active Study Rooms */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Active Study Rooms</h3>
            <button onClick={() => navigate('/rooms')} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              View All
            </button>
          </div>
          <div className="p-4 space-y-3">
            {activeRooms.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No active rooms right now</p>
            ) : activeRooms.map(room => (
              <div key={room.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{room.name}</p>
                  <p className="text-xs text-gray-500">{room.participants} participants</p>
                </div>
                <button
                  onClick={() => navigate(`/room/${room.id}`)}
                  className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent Sessions</h3>
            <button onClick={() => navigate('/rooms')} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              View All
            </button>
          </div>
          <div className="p-4 space-y-3">
            {recentSessions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No recent sessions</p>
            ) : recentSessions.map((session, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
                  <i className="ri-video-line text-xl text-gray-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{session.name}</p>
                  <p className="text-xs text-gray-500">{session.duration} • {session.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Upcoming Sessions</h3>
            <button onClick={() => navigate('/schedule')} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              View All
            </button>
          </div>
          <div className="p-4 space-y-3">
            {upcomingSessions.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No upcoming sessions</p>
            ) : upcomingSessions.map((session, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{session.name}</p>
                  <p className="text-xs text-gray-500">{session.time}</p>
                </div>
                <button
                  onClick={() => navigate(`/room/${session.id}`)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        {/* Study Progress */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Study Progress</h3>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button className="px-3 py-1 text-xs font-medium rounded-md bg-white shadow-sm text-gray-900">Week</button>
              <button className="px-3 py-1 text-xs font-medium rounded-md text-gray-500 hover:text-gray-700">Month</button>
            </div>
          </div>
          {studyProgressData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">No study data yet. Start a session!</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={studyProgressData}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  formatter={(value) => [`${value} hrs`, 'Study Time']}
                />
                <Area type="monotone" dataKey="hours" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorHours)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Subject Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Subject Distribution</h3>
          {subjectData.filter(s => s.value > 0).length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">No subject data available</div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={subjectData.filter(s => s.value > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    label={false}
                  >
                    {subjectData.filter(s => s.value > 0).map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-2">
                {subjectData.filter(s => s.value > 0).map((entry, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-gray-700">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="truncate max-w-[100px]">{entry.name}</span>
                    <span className="text-gray-400">{entry.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
