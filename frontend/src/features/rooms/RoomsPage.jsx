import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../../components/ui/Modal'
import { getActiveRooms, getUserRoomStats } from '../../lib/roomApiV2'

export default function RoomsPage() {
  const navigate = useNavigate()
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [joinUrl, setJoinUrl] = useState('')
  const [activeRooms, setActiveRooms] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [upcomingSessions, setUpcomingSessions] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('active') // active, recent, upcoming

  useEffect(() => {
    let mounted = true
    const loadRooms = async () => {
      setRoomsLoading(true)
      try {
        const [activeData, statsData] = await Promise.all([
          getActiveRooms().catch(() => ({ rooms: [] })),
          getUserRoomStats().catch(() => ({ 
            activeSessions: [], 
            recentSessions: [], 
            upcomingSessions: [] 
          }))
        ])
        
        if (!mounted) return
        
        // Map active rooms
        const mappedActive = (activeData.rooms || []).map(r => ({
          id: r._id,
          name: r.name,
          description: r.subject,
          status: 'Active',
          participants: r.participants?.length || 0,
          time: 'Created ' + new Date(r.createdAt).toLocaleDateString(),
          host: r.createdBy?.name || 'Host',
          isUserRoom: false,
        }))
        
        // Map recent sessions
        const mappedRecent = (statsData.recentSessions || []).map(r => ({
          id: r._id,
          name: r.name,
          description: r.subject,
          status: 'Completed',
          participants: r.maxParticipants || r.participants?.length || 0,
          duration: r.duration ? `${Math.round(r.duration)} min` : 'N/A',
          time: r.endedAt ? new Date(r.endedAt).toLocaleString() : 'Recently',
          host: r.createdBy?.name || 'Host',
          isUserRoom: false,
        }))
        
        // Map upcoming sessions
        const mappedUpcoming = (statsData.upcomingSessions || []).map(r => ({
          id: r._id,
          name: r.name,
          description: r.subject,
          status: 'Scheduled',
          participants: r.participants?.length || 0,
          time: r.scheduledFor ? new Date(r.scheduledFor).toLocaleString() : 'Soon',
          host: r.createdBy?.name || 'Host',
          isUserRoom: false,
        }))
        
        setActiveRooms(mappedActive)
        setRecentSessions(mappedRecent)
        setUpcomingSessions(mappedUpcoming)
      } catch (err) {
        console.error('Failed to load rooms:', err)
        if (!mounted) return
        setActiveRooms([])
        setRecentSessions([])
        setUpcomingSessions([])
      } finally {
        if (mounted) setRoomsLoading(false)
      }
    }

    loadRooms()
    const interval = setInterval(loadRooms, 10000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])

  const handleJoinByUrl = () => {
    if (!joinUrl.trim()) return
    const idMatch = joinUrl.match(/room\/([a-zA-Z0-9_-]+)/) || joinUrl.match(/id=([a-zA-Z0-9_-]+)/)
    const roomId = idMatch ? idMatch[1] : joinUrl.trim()
    setJoinModalOpen(false)
    setJoinUrl('')
    navigate(`/room/${roomId}`)
  }

  const statusBadge = (status) => {
    const classes = {
      'Active': 'bg-green-100 text-green-700',
      'Completed': 'bg-gray-100 text-gray-700',
      'Scheduled': 'bg-blue-100 text-blue-700',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${classes[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    )
  }

  const getCurrentRooms = () => {
    switch (activeTab) {
      case 'active': return activeRooms
      case 'recent': return recentSessions
      case 'upcoming': return upcomingSessions
      default: return activeRooms
    }
  }

  const currentRooms = getCurrentRooms()

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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-live-line mr-1" />
          Active ({activeRooms.length})
        </button>
        <button
          onClick={() => setActiveTab('recent')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'recent'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-history-line mr-1" />
          Recent ({recentSessions.length})
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'upcoming'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-calendar-line mr-1" />
          Upcoming ({upcomingSessions.length})
        </button>
      </div>

      {/* Rooms Grid */}
      {roomsLoading && (
        <div className="text-sm text-gray-500">Loading sessions...</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {currentRooms.length === 0 && !roomsLoading && (
          <div className="col-span-full text-center py-12">
            <i className="ri-video-chat-line text-4xl text-gray-300" />
            <p className="text-gray-500 mt-2 text-sm">
              {activeTab === 'active' && 'No active rooms. Create one to get started!'}
              {activeTab === 'recent' && 'No recent sessions yet.'}
              {activeTab === 'upcoming' && 'No upcoming sessions scheduled.'}
            </p>
          </div>
        )}
        {currentRooms.map(room => (
          <div key={room.id} className={`bg-white border rounded-lg shadow-sm p-3 sm:p-5 ${room.isUserRoom ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{room.name}</h3>
                  {room.isUserRoom && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">Your Room</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{room.description}</p>
              </div>
              {statusBadge(room.status)}
            </div>
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <i className="ri-group-line" />
                <span>{room.participants} participants</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <i className="ri-time-line" />
                <span>{room.time}</span>
              </div>
              {room.duration && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <i className="ri-timer-line" />
                  <span>Duration: {room.duration}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <i className="ri-user-star-line" />
                <span>Host: {room.host}</span>
              </div>
            </div>
            {activeTab === 'active' && (
              <button
                onClick={() => navigate(`/room/${room.id}`)}
                className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Join Room
              </button>
            )}
            {activeTab === 'recent' && (
              <button
                onClick={() => navigate(`/room/${room.id}`)}
                className="w-full py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                View Details
              </button>
            )}
            {activeTab === 'upcoming' && (
              <button
                onClick={() => navigate(`/room/${room.id}`)}
                className="w-full py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                View Session
              </button>
            )}
          </div>
        ))}
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
