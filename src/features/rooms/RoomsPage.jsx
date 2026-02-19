import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/ui/Modal'

const categories = ['All Rooms', 'Computer Science', 'Mathematics', 'Physics']

const roomsData = [
  { id: '1', name: 'Advanced Algorithms', description: 'Graph Theory & Dynamic Programming', status: 'Active', participants: 8, max: 12, time: 'Started 45 min ago', host: 'Dr. Smith', category: 'Computer Science' },
  { id: '2', name: 'Database Systems', description: 'SQL Optimization & Normalization', status: 'Active', participants: 5, max: 10, time: 'Started 20 min ago', host: 'Prof. Lee', category: 'Computer Science' },
  { id: '3', name: 'Linear Algebra', description: 'Eigenvalues & Eigenvectors', status: 'Starting Soon', participants: 3, max: 8, time: 'Starts in 15 min', host: 'Dr. Park', category: 'Mathematics' },
  { id: '4', name: 'Network Security', description: 'Cryptography & Protocols', status: 'Active', participants: 6, max: 10, time: 'Started 1 hr ago', host: 'Prof. Chen', category: 'Computer Science' },
  { id: '5', name: 'Quantum Physics', description: 'Wave-Particle Duality', status: 'Starting Soon', participants: 2, max: 6, time: 'Starts in 30 min', host: 'Dr. Kumar', category: 'Physics' },
  { id: '6', name: 'Calculus III', description: 'Multivariable Calculus', status: 'Active', participants: 10, max: 15, time: 'Started 10 min ago', host: 'Prof. Johnson', category: 'Mathematics' },
]

const upcomingRooms = [
  { id: '10', name: 'ML Study Group', description: 'Neural Networks Review', date: 'Today, 6:00 PM', participants: 4, host: 'Alice' },
  { id: '11', name: 'Physics Problem Set', description: 'Mechanics & Thermodynamics', date: 'Tomorrow, 10:00 AM', participants: 7, host: 'Bob' },
]

export default function RoomsPage() {
  const navigate = useNavigate()
  const [activeCategory, setActiveCategory] = useState('All Rooms')
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [joinUrl, setJoinUrl] = useState('')

  const filteredRooms = activeCategory === 'All Rooms'
    ? roomsData
    : roomsData.filter(r => r.category === activeCategory)

  const handleJoinByUrl = () => {
    if (!joinUrl.trim()) return
    const idMatch = joinUrl.match(/room\/([a-zA-Z0-9]+)/) || joinUrl.match(/id=([a-zA-Z0-9]+)/)
    const roomId = idMatch ? idMatch[1] : joinUrl.trim()
    setJoinModalOpen(false)
    setJoinUrl('')
    navigate(`/room/${roomId}`)
  }

  const statusBadge = (status) => {
    const classes = {
      'Active': 'bg-green-100 text-green-700',
      'Starting Soon': 'bg-yellow-100 text-yellow-700',
      'Scheduled': 'bg-blue-100 text-blue-700',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${classes[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search rooms..."
            className="w-full sm:w-64 h-10 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={() => setJoinModalOpen(true)}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <i className="ri-link mr-1" />
            <span className="hidden xs:inline">Join Room</span>
            <span className="xs:hidden">Join</span>
          </button>
          <button
            onClick={() => navigate('/create-room')}
            className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <i className="ri-add-line mr-1" />
            <span className="hidden xs:inline">Create Room</span>
            <span className="xs:hidden">Create</span>
          </button>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 study-feature-tabs">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeCategory === cat
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Active Rooms Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {filteredRooms.map(room => (
          <div key={room.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 sm:p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{room.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{room.description}</p>
              </div>
              {statusBadge(room.status)}
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <i className="ri-group-line" />
                <span>{room.participants} participants (max {room.max})</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <i className="ri-time-line" />
                <span>{room.time}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <i className="ri-user-star-line" />
                <span>Host: {room.host}</span>
              </div>
            </div>
            <button
              onClick={() => navigate(`/room/${room.id}`)}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Join Room
            </button>
          </div>
        ))}
      </div>

      {/* Upcoming Sessions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Study Sessions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {upcomingRooms.map(room => (
            <div key={room.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 sm:p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{room.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{room.description}</p>
                </div>
                {statusBadge('Scheduled')}
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <i className="ri-calendar-line" />
                  <span>{room.date}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <i className="ri-group-line" />
                  <span>{room.participants} signed up</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <i className="ri-user-star-line" />
                  <span>Host: {room.host}</span>
                </div>
              </div>
              <button className="w-full py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Set Reminder
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Join Room Modal */}
      <Modal isOpen={joinModalOpen} onClose={() => setJoinModalOpen(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Join a Study Room</h3>
          <input
            type="text"
            placeholder="Paste room URL or ID..."
            value={joinUrl}
            onChange={e => setJoinUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleJoinByUrl()}
            className="w-full h-12 px-4 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-4"
          />
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setJoinModalOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleJoinByUrl}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
            >
              Join Room
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
