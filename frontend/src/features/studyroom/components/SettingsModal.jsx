import { useState, useEffect } from 'react'
import Modal from '../../../components/ui/Modal'
import { getSocket } from '../../../lib/socket'

const getTabIcons = (isHost) => {
  const tabs = {
    Participants: 'ri-group-line',
    Audio: 'ri-mic-line',
    Video: 'ri-vidicon-line',
    Meeting: 'ri-settings-3-line',
  }
  if (isHost) {
    tabs['Host Controls'] = 'ri-shield-user-line'
  }
  return tabs
}

export default function SettingsModal({ isOpen, onClose, roomId, isHost, participants: participantsProp }) {
  const [activeTab, setActiveTab] = useState('Participants')
  const [waitingRoom, setWaitingRoom] = useState(false)
  const [screenSharing, setScreenSharing] = useState(true)
  const [participants, setParticipants] = useState(participantsProp || [])

  // Sync participants from prop
  useEffect(() => {
    if (participantsProp) setParticipants(participantsProp)
  }, [participantsProp])

  // Subscribe to real-time participant updates
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

  // Host control handlers
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

  const tabIcons = getTabIcons(isHost)

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-4xl">
      <div className="flex flex-col sm:flex-row h-[100dvh] sm:h-[500px] max-h-[100dvh] sm:max-h-[80vh]">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 border-b border-gray-200 z-10 bg-white">
          <h3 className="text-sm font-semibold text-gray-900">Settings</h3>
          <div className="flex gap-1">
            <button className="hidden sm:flex w-6 h-6 rounded items-center justify-center text-gray-400 hover:bg-gray-100">
              <i className="ri-subtract-line text-xs" />
            </button>
            <button className="hidden sm:flex w-6 h-6 rounded items-center justify-center text-gray-400 hover:bg-gray-100">
              <i className="ri-checkbox-blank-line text-xs" />
            </button>
            <button
              onClick={onClose}
              className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:bg-red-500 hover:text-white"
            >
              <i className="ri-close-line text-xs" />
            </button>
          </div>
        </div>

        {/* Sidebar - horizontal tabs on mobile, vertical on desktop */}
        <div className="sm:w-56 bg-gray-50 sm:border-r border-b sm:border-b-0 border-gray-200 pt-10 sm:pt-12 px-2 pb-1 sm:pb-0 shrink-0">
          <div className="flex sm:flex-col gap-1 overflow-x-auto sm:overflow-x-visible">
          {Object.entries(tabIcons).map(([tab, icon]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                activeTab === tab ? 'bg-gray-200 text-gray-900 font-medium' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <i className={`${icon} text-base`} />
              <span className="hidden xs:inline sm:inline">{tab}</span>
            </button>
          ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 pt-2 sm:pt-12 p-4 overflow-y-auto min-h-0">
          {activeTab === 'Participants' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 font-medium">{participants.length} participant{participants.length !== 1 ? 's' : ''} online</span>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
              {participants.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <i className="ri-group-line text-3xl" />
                  <p className="text-sm mt-2">No participants yet</p>
                </div>
              )}
              {participants.map((p) => (
                <div key={p.socketId} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <div className="w-9 h-9 rounded-full bg-[#F2CF7E]/20 flex items-center justify-center relative">
                    <span className="text-sm font-medium text-black">{(p.name || '?').charAt(0).toUpperCase()}</span>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                      {p.isHost && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#F2CF7E]/20 text-[#b8941e]">Host</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      {p.joinedAt ? `Joined ${new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Online'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <i className={`text-sm ${p.audioOn !== false ? 'ri-mic-line text-green-500' : 'ri-mic-off-line text-red-400'}`} />
                    <i className={`text-sm ${p.videoOn !== false ? 'ri-vidicon-line text-green-500' : 'ri-vidicon-off-line text-red-400'}`} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'Host Controls' && isHost && (
            <div className="space-y-4">
              {/* Bulk Actions */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Bulk Actions</h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleMuteAll}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 transition-colors"
                  >
                    <i className="ri-mic-off-line" />
                    Mute All
                  </button>
                  <button
                    onClick={handleUnmuteAll}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-green-50 text-green-600 text-sm font-medium hover:bg-green-100 transition-colors"
                  >
                    <i className="ri-mic-line" />
                    Unmute All
                  </button>
                </div>
              </div>

              {/* Individual Participant Controls */}
              <div>
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Manage Participants</h4>
                {participants.filter(p => !p.isHost).length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    No other participants to manage
                  </div>
                )}
                <div className="space-y-2">
                  {participants.filter(p => !p.isHost).map((p) => (
                    <div key={p.socketId} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">{(p.name || 'U').slice(0, 2).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs flex items-center gap-0.5 ${p.audioOn ? 'text-green-500' : 'text-red-400'}`}>
                            <i className={p.audioOn ? 'ri-mic-line' : 'ri-mic-off-line'} />
                          </span>
                          <span className={`text-xs flex items-center gap-0.5 ${p.videoOn ? 'text-green-500' : 'text-red-400'}`}>
                            <i className={p.videoOn ? 'ri-vidicon-line' : 'ri-vidicon-off-line'} />
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMuteParticipant(p.socketId, p.audioOn)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors ${
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
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-colors ${
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
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-500 transition-colors"
                          title="Remove from room"
                        >
                          <i className="ri-user-unfollow-line" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Audio' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Microphone</label>
                <select className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E]">
                  <option>Default Microphone</option>
                  <option>External Microphone</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Speaker</label>
                <select className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E]">
                  <option>Default Speaker</option>
                  <option>External Speaker</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'Video' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Camera</label>
              <select className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E]">
                <option>Default Camera</option>
                <option>External Webcam</option>
              </select>
            </div>
          )}

          {activeTab === 'Meeting' && (
            <div className="space-y-4">
              <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Enable Waiting Room</span>
                <input
                  type="checkbox"
                  checked={waitingRoom}
                  onChange={e => setWaitingRoom(e.target.checked)}
                  className="rounded border-gray-300 text-black focus:ring-[#F2CF7E]"
                />
              </label>
              <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Allow Screen Sharing</span>
                <input
                  type="checkbox"
                  checked={screenSharing}
                  onChange={e => setScreenSharing(e.target.checked)}
                  className="rounded border-gray-300 text-black focus:ring-[#F2CF7E]"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

