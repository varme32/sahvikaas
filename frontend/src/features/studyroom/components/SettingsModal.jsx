import { useState, useEffect } from 'react'
import Modal from '../../../components/ui/Modal'
import { getSocket } from '../../../lib/socket'

const tabIcons = {
  Participants: 'ri-group-line',
  Audio: 'ri-mic-line',
  Video: 'ri-vidicon-line',
  Meeting: 'ri-settings-3-line',
}

export default function SettingsModal({ isOpen, onClose, roomId }) {
  const [activeTab, setActiveTab] = useState('Participants')
  const [waitingRoom, setWaitingRoom] = useState(false)
  const [screenSharing, setScreenSharing] = useState(true)
  const [participants, setParticipants] = useState([])

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
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center relative">
                    <span className="text-sm font-medium text-indigo-600">{(p.name || '?').charAt(0).toUpperCase()}</span>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{p.name}</p>
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

          {activeTab === 'Audio' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Microphone</label>
                <select className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500">
                  <option>Default Microphone</option>
                  <option>External Microphone</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Speaker</label>
                <select className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500">
                  <option>Default Speaker</option>
                  <option>External Speaker</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'Video' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Camera</label>
              <select className="w-full h-10 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500">
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
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg cursor-pointer">
                <span className="text-sm font-medium text-gray-700">Allow Screen Sharing</span>
                <input
                  type="checkbox"
                  checked={screenSharing}
                  onChange={e => setScreenSharing(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
