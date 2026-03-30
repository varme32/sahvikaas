import { useState, useEffect } from 'react'
import Modal from '../../../components/ui/Modal'
import { getSocket } from '../../../lib/socket'

export default function PointsModal({ isOpen, onClose, roomId, userName }) {
  const [activeTab, setActiveTab] = useState('breakdown')
  const [leaderboard, setLeaderboard] = useState([])
  const [userPoints, setUserPoints] = useState({ points: 0, activities: [] })

  // Subscribe to real-time points updates
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handlePointsUpdated = (data) => {
      if (data.leaderboard) setLeaderboard(data.leaderboard)
      if (data.userPoints) setUserPoints(data.userPoints)
    }

    socket.on('points-updated', handlePointsUpdated)

    // Request points data when modal opens
    if (isOpen && roomId) {
      socket.emit('get-points', { meetingId: roomId })
    }

    return () => {
      socket.off('points-updated', handlePointsUpdated)
    }
  }, [isOpen, roomId])

  const totalPoints = userPoints?.points || 0
  const pointsBreakdown = userPoints?.activities || []

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Points & Achievements</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100">
            <i className="ri-close-line" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'breakdown'
                ? 'border-[#F2CF7E] text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Points Breakdown
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'leaderboard'
                ? 'border-[#F2CF7E] text-black'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Leaderboard
          </button>
        </div>

        {/* Content */}
        {activeTab === 'breakdown' && (
          <div className="space-y-3">
            <div className="text-center py-3">
              <p className="text-3xl font-bold text-black">{totalPoints}</p>
              <p className="text-sm text-gray-500">Total Points</p>
            </div>
            {pointsBreakdown.length === 0 && (
              <div className="text-center py-6 text-gray-400">
                <i className="ri-trophy-line text-3xl" />
                <p className="text-sm mt-2">No points earned yet</p>
                <p className="text-xs mt-1">Start studying to earn points!</p>
              </div>
            )}
            {pointsBreakdown.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">{item.label}</span>
                <span className="text-sm font-semibold text-black">+{item.points}</span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'leaderboard' && (
          <div className="space-y-2">
            {leaderboard.length === 0 && (
              <div className="text-center py-6 text-gray-400">
                <i className="ri-bar-chart-line text-3xl" />
                <p className="text-sm mt-2">Leaderboard is empty</p>
                <p className="text-xs mt-1">Earn points to appear here!</p>
              </div>
            )}
            {leaderboard.map(user => {
              const isSelf = user.name === userName
              return (
                <div
                  key={user.rank}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    isSelf ? 'bg-[#F2CF7E]/10 border border-[#F2CF7E]/30' : 'bg-gray-50'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    user.rank === 1 ? 'bg-yellow-400 text-white' :
                    user.rank === 2 ? 'bg-gray-400 text-white' :
                    user.rank === 3 ? 'bg-orange-400 text-white' :
                    'bg-gray-200 text-gray-600'
                  }`}>
                    {user.rank}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {user.name}
                      {isSelf && <span className="ml-2 text-xs text-black">(You)</span>}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{user.points} pts</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

