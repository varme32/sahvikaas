import { useState, useEffect } from 'react'
import { getSocket } from '../../../lib/socket'

export default function ParticipantsPanel({ roomId, isHost }) {
  const [participants, setParticipants] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleParticipants = (list) => {
      setParticipants(list)
    }

    socket.on('participants-updated', handleParticipants)

    return () => {
      socket.off('participants-updated', handleParticipants)
    }
  }, [])

  const handleMuteParticipant = (socketId, currentlyOn) => {
    const socket = getSocket()
    if (!socket) return
    socket.emit('host-mute-participant', { meetingId: roomId, targetSocketId: socketId, mute: currentlyOn })
  }

  const handleDisableVideo = (socketId, currentlyOn) => {
    const socket = getSocket()
    if (!socket) return
    socket.emit('host-disable-video', { meetingId: roomId, targetSocketId: socketId, disable: currentlyOn })
  }

  const handleRemoveParticipant = (socketId, name) => {
    if (!window.confirm(`Remove ${name} from the room?`)) return
    const socket = getSocket()
    if (!socket) return
    socket.emit('host-remove-participant', { meetingId: roomId, targetSocketId: socketId })
  }

  const handleMuteAll = () => {
    const socket = getSocket()
    if (!socket) return
    socket.emit('host-mute-all', { meetingId: roomId, mute: true })
  }

  const handleUnmuteAll = () => {
    const socket = getSocket()
    if (!socket) return
    socket.emit('host-mute-all', { meetingId: roomId, mute: false })
  }

  const filtered = participants.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const hostParticipants = filtered.filter(p => p.isHost)
  const otherParticipants = filtered.filter(p => !p.isHost)
  const sortedParticipants = [...hostParticipants, ...otherParticipants]

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-800 text-sm">
            <i className="ri-group-line mr-1.5" />
            Participants ({participants.length})
          </h3>
        </div>

        {/* Search */}
        <div className="relative">
          <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            placeholder="Search participants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-3 rounded-md border border-gray-200 text-xs text-black placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
          />
        </div>

        {/* Host Controls - Bulk Actions */}
        {isHost && participants.length > 1 && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleMuteAll}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-colors"
            >
              <i className="ri-mic-off-line text-sm" />
              Mute All
            </button>
            <button
              onClick={handleUnmuteAll}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md bg-green-50 text-green-600 text-xs font-medium hover:bg-green-100 transition-colors"
            >
              <i className="ri-mic-line text-sm" />
              Unmute All
            </button>
          </div>
        )}
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto">
        {sortedParticipants.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            {searchQuery ? 'No participants found' : 'No participants yet'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedParticipants.map((p) => (
              <div
                key={p.socketId}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold shrink-0 ${
                  p.isHost ? 'bg-[#F2CF7E]/30 text-[#b8941e]' : 'bg-gray-100 text-gray-600'
                }`}>
                  {(p.name || 'U').slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-800 truncate">{p.name}</span>
                    {p.isHost && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F2CF7E]/20 text-[#b8941e]">
                        Host
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {/* Audio/Video indicators */}
                    <span className={`text-xs flex items-center gap-0.5 ${p.audioOn ? 'text-green-500' : 'text-red-400'}`}>
                      <i className={p.audioOn ? 'ri-mic-line' : 'ri-mic-off-line'} />
                    </span>
                    <span className={`text-xs flex items-center gap-0.5 ${p.videoOn ? 'text-green-500' : 'text-red-400'}`}>
                      <i className={p.videoOn ? 'ri-vidicon-line' : 'ri-vidicon-off-line'} />
                    </span>
                    {p.isMobile && (
                      <span className="text-xs text-gray-400">
                        <i className="ri-smartphone-line" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Host Actions (don't show for self/host) */}
                {isHost && !p.isHost && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleMuteParticipant(p.socketId, p.audioOn)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors ${
                        p.audioOn
                          ? 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-500'
                          : 'bg-red-100 text-red-500 hover:bg-green-100 hover:text-green-500'
                      }`}
                      title={p.audioOn ? 'Mute' : 'Unmute'}
                    >
                      <i className={p.audioOn ? 'ri-mic-off-line' : 'ri-mic-line'} />
                    </button>
                    <button
                      onClick={() => handleDisableVideo(p.socketId, p.videoOn)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors ${
                        p.videoOn
                          ? 'bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-500'
                          : 'bg-red-100 text-red-500 hover:bg-green-100 hover:text-green-500'
                      }`}
                      title={p.videoOn ? 'Turn off video' : 'Turn on video'}
                    >
                      <i className={p.videoOn ? 'ri-vidicon-off-line' : 'ri-vidicon-line'} />
                    </button>
                    <button
                      onClick={() => handleRemoveParticipant(p.socketId, p.name)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-500 transition-colors"
                      title="Remove from room"
                    >
                      <i className="ri-user-unfollow-line" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
