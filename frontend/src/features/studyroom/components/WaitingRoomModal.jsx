import { useEffect, useState } from 'react'
import Modal from '../../../components/ui/Modal'
import { getSocket } from '../../../lib/socket'

export default function WaitingRoomModal({ isOpen, onClose, roomId }) {
  const [waitingList, setWaitingList] = useState([])

  useEffect(() => {
    if (!isOpen) return

    const socket = getSocket()
    if (!socket) return

    // Request current waiting list
    socket.emit('get-waiting-list', { meetingId: roomId })

    // Listen for waiting list updates
    const handleWaitingListUpdate = (data) => {
      setWaitingList(data.waitingList || [])
    }

    const handleParticipantWaiting = (data) => {
      setWaitingList(data.waitingList || [])
    }

    socket.on('waiting-list-updated', handleWaitingListUpdate)
    socket.on('participant-waiting', handleParticipantWaiting)

    return () => {
      socket.off('waiting-list-updated', handleWaitingListUpdate)
      socket.off('participant-waiting', handleParticipantWaiting)
    }
  }, [isOpen, roomId])

  // Auto-close modal when waiting list becomes empty
  useEffect(() => {
    if (isOpen && waitingList.length === 0) {
      // Small delay so host can see the list clear before it closes
      const timer = setTimeout(() => {
        if (waitingList.length === 0) onClose()
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [waitingList.length, isOpen, onClose])

  const handleApprove = (socketId) => {
    const socket = getSocket()
    if (socket) {
      socket.emit('approve-participant', { meetingId: roomId, socketId })
    }
    // Optimistically remove from local list
    setWaitingList(prev => prev.filter(p => p.socketId !== socketId))
  }

  const handleDeny = (socketId) => {
    const socket = getSocket()
    if (socket) {
      socket.emit('deny-participant', { meetingId: roomId, socketId })
    }
    // Optimistically remove from local list
    setWaitingList(prev => prev.filter(p => p.socketId !== socketId))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Waiting Room">
      <div className="space-y-4">
        {waitingList.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <i className="ri-user-line text-4xl mb-2" />
            <p>No participants waiting</p>
          </div>
        ) : (
          <div className="space-y-3">
            {waitingList.map((participant) => (
              <div
                key={participant.socketId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#F2CF7E] flex items-center justify-center">
                    <i className="ri-user-line text-lg text-black" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{participant.name}</h4>
                    <p className="text-xs text-gray-500">
                      Requested {new Date(participant.requestedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(participant.socketId)}
                    className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                    title="Admit"
                  >
                    <i className="ri-check-line" />
                  </button>
                  <button
                    onClick={() => handleDeny(participant.socketId)}
                    className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                    title="Deny"
                  >
                    <i className="ri-close-line" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
