import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const studyProgressData = [
  { day: 'Mon', hours: 2.5 },
  { day: 'Tue', hours: 3.8 },
  { day: 'Wed', hours: 3.0 },
  { day: 'Thu', hours: 4.2 },
  { day: 'Fri', hours: 3.5 },
  { day: 'Sat', hours: 5.0 },
  { day: 'Sun', hours: 4.0 },
]

const subjectData = [
  { name: 'Algorithms', value: 35, color: '#6366f1' },
  { name: 'Database', value: 25, color: '#14b8a6' },
  { name: 'Networks', value: 20, color: '#f97316' },
  { name: 'OS', value: 20, color: '#f43f5e' },
]

const activeRooms = [
  { id: '1', name: 'Advanced Algorithms', participants: 8 },
  { id: '2', name: 'Database Systems', participants: 5 },
]

const recentResources = [
  { name: 'ML Lecture Notes.pdf', size: '2.4 MB', icon: 'ri-file-pdf-2-line', color: 'text-red-500 bg-red-50' },
  { name: 'Database Slides.pptx', size: '5.1 MB', icon: 'ri-file-ppt-2-line', color: 'text-orange-500 bg-orange-50' },
]

const upcomingSessions = [
  { name: 'Data Structures Review', date: 'Today, 4:00 PM', participants: 6 },
  { name: 'ML Project Discussion', date: 'Tomorrow, 2:00 PM', participants: 4 },
]

export default function DashboardPage() {
  const navigate = useNavigate()

  return (
    <div className="space-y-4 sm:space-y-6">
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
            {activeRooms.map(room => (
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

        {/* Recent Resources */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Recent Resources</h3>
            <button onClick={() => navigate('/resources')} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              View All
            </button>
          </div>
          <div className="p-4 space-y-3">
            {recentResources.map((res, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${res.color}`}>
                  <i className={`${res.icon} text-xl`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{res.name}</p>
                  <p className="text-xs text-gray-500">{res.size}</p>
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
            {upcomingSessions.map((session, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{session.name}</p>
                  <p className="text-xs text-gray-500">{session.date}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <i className="ri-group-line" />
                  {session.participants}
                </div>
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
        </div>

        {/* Subject Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Subject Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={subjectData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                label={({ name, value }) => `${name} ${value}%`}
              >
                {subjectData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`${value}%`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
