import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import { getDashboardSummary } from '../../lib/api'
import { getUserRoomStats } from '../../lib/roomApiV2'
import { useAuth } from '../../lib/auth'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
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
          <div className="w-8 h-8 border-3 border-[#F2CF7E] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Card with Create Room Button */}
      <div className="bg-[#F2CF7E] rounded-xl border border-[#e0bd6c] shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center">
              <span className="text-2xl font-bold text-black">
                {user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'U'}
              </span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-black">
                Welcome back, {user?.name?.split(' ')[0] || 'Student'}! 👋
              </h1>
              <p className="text-sm sm:text-base text-black/80 mt-1">
                Ready to start your study session? Let's make today productive!
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/create-room')}
            className="w-full sm:w-auto px-6 py-3 bg-black text-white rounded-lg font-semibold hover:bg-black/90 transition-colors flex items-center justify-center gap-2 shadow-md"
          >
            <i className="ri-add-circle-line text-xl" />
            Create Room
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-[#F2CF7E] rounded-xl border border-[#e0bd6c] shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/30 flex items-center justify-center">
              <i className="ri-time-line text-2xl text-black" />
            </div>
            <div>
              <p className="text-sm text-black/80 mb-1">Total Study Time</p>
              <p className="text-2xl font-bold text-black">{totalHours}h</p>
            </div>
          </div>
        </div>
        
        <div className="bg-[#F2CF7E] rounded-xl border border-[#e0bd6c] shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/30 flex items-center justify-center">
              <i className="ri-video-chat-line text-2xl text-black" />
            </div>
            <div>
              <p className="text-sm text-black/80 mb-1">Total Sessions</p>
              <p className="text-2xl font-bold text-black">{totalSessions}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-[#F2CF7E] rounded-xl border border-[#e0bd6c] shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/30 flex items-center justify-center">
              <i className="ri-live-line text-2xl text-black" />
            </div>
            <div>
              <p className="text-sm text-black/80 mb-1">Active Now</p>
              <p className="text-2xl font-bold text-black">{activeRooms.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-[#F2CF7E] rounded-xl border border-[#e0bd6c] shadow-sm p-5 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/30 flex items-center justify-center">
              <i className="ri-calendar-line text-2xl text-black" />
            </div>
            <div>
              <p className="text-sm text-black/80 mb-1">Upcoming</p>
              <p className="text-2xl font-bold text-black">{upcomingSessions.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
        {/* Active Study Rooms */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h3 className="font-semibold text-black">Active Study Rooms</h3>
            <button onClick={() => navigate('/rooms')} className="text-sm text-[#F2CF7E] hover:text-[#e0bd6c] font-medium transition-colors">
              View All
            </button>
          </div>
          <div className="p-5 space-y-3">
            {activeRooms.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No active rooms right now</p>
            ) : activeRooms.map(room => (
              <div key={room.id} className="flex items-center justify-between p-4 bg-[#eeeeee] rounded-lg border border-gray-100 hover:border-[#F2CF7E]/30 transition-colors">
                <div>
                  <p className="text-sm font-medium text-black">{room.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{room.participants} participants</p>
                </div>
                <button
                  onClick={() => navigate(`/room/${room.id}`)}
                  className="px-4 py-2 bg-[#F2CF7E] text-black text-xs font-semibold rounded-lg hover:bg-[#e0bd6c] transition-colors"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h3 className="font-semibold text-black">Recent Sessions</h3>
            <button onClick={() => navigate('/rooms')} className="text-sm text-[#F2CF7E] hover:text-[#e0bd6c] font-medium transition-colors">
              View All
            </button>
          </div>
          <div className="p-5 space-y-3">
            {recentSessions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No recent sessions</p>
            ) : recentSessions.map((session, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-[#eeeeee] rounded-lg border border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-[#F2CF7E]/10 flex items-center justify-center">
                  <i className="ri-video-line text-xl text-[#F2CF7E]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-black">{session.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{session.duration} • {session.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Sessions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h3 className="font-semibold text-black">Upcoming Sessions</h3>
            <button onClick={() => navigate('/schedule')} className="text-sm text-[#F2CF7E] hover:text-[#e0bd6c] font-medium transition-colors">
              View All
            </button>
          </div>
          <div className="p-5 space-y-3">
            {upcomingSessions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No upcoming sessions</p>
            ) : upcomingSessions.map((session, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-[#eeeeee] rounded-lg border border-gray-100 hover:border-[#F2CF7E]/30 transition-colors">
                <div>
                  <p className="text-sm font-medium text-black">{session.name}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{session.time}</p>
                </div>
                <button
                  onClick={() => navigate(`/room/${session.id}`)}
                  className="px-4 py-2 bg-[#F2CF7E] text-black text-xs font-semibold rounded-lg hover:bg-[#e0bd6c] transition-colors"
                >
                  View
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
        {/* Study Progress */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-black">Study Progress</h3>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button className="px-3 py-1.5 text-xs font-medium rounded-md bg-[#F2CF7E] text-black">Week</button>
              <button className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-600 hover:text-black transition-colors">Month</button>
            </div>
          </div>
          {studyProgressData.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-sm text-gray-500">No study data yet. Start a session!</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={studyProgressData}>
                <defs>
                  <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F2CF7E" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F2CF7E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#666666' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#666666' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px', backgroundColor: '#ffffff' }}
                  formatter={(value) => [`${value} hrs`, 'Study Time']}
                />
                <Area type="monotone" dataKey="hours" stroke="#F2CF7E" strokeWidth={2} fillOpacity={1} fill="url(#colorHours)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Subject Distribution */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <h3 className="font-semibold text-black mb-5">Subject Distribution</h3>
          {subjectData.filter(s => s.value > 0).length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-sm text-gray-500">No subject data available</div>
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
                  <Tooltip 
                    formatter={(value, name) => [`${value}%`, name]}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', fontSize: '12px', backgroundColor: '#ffffff' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-3">
                {subjectData.filter(s => s.value > 0).map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-black">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                    <span className="truncate max-w-[100px] font-medium">{entry.name}</span>
                    <span className="text-gray-600">{entry.value}%</span>
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
