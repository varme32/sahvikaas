import { useState, useRef, useEffect, useCallback } from 'react'
import { connectSocket, getSocket } from '../../../lib/socket'
import { getWebRtcIceConfig } from '../../../lib/api'

const DEFAULT_ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
}

export default function VideoPanel({ meetingId, isMicOn, isVideoOn, isScreenSharing, onScreenShareChange, userName }) {
  const [participants, setParticipants] = useState(new Map())
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

  const localVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const screenStreamRef = useRef(null)
  const peersRef = useRef(new Map())
  const iceConfigRef = useRef(DEFAULT_ICE_CONFIG)
  const pendingIceRef = useRef(new Map())
  const panelRef = useRef(null)
  const socketRef = useRef(null)
  const activeMeetingRef = useRef(null)
  const userNameRef = useRef(userName || 'User ' + Math.floor(Math.random() * 1000))

  // ========== AUTO-CONNECT on mount ==========
  useEffect(() => {
    if (!meetingId) return
    let cancelled = false

    const connectToRoom = async () => {
      try {
        setConnecting(true)
        setError('')

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        })

        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return }

        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        stream.getAudioTracks().forEach(t => { t.enabled = isMicOn })
        stream.getVideoTracks().forEach(t => { t.enabled = isVideoOn })

        try {
          const remoteIceConfig = await getWebRtcIceConfig()
          if (remoteIceConfig?.iceServers?.length) {
            iceConfigRef.current = {
              ...DEFAULT_ICE_CONFIG,
              ...remoteIceConfig,
            }
          }
        } catch {
          iceConfigRef.current = DEFAULT_ICE_CONFIG
        }

        activeMeetingRef.current = meetingId
        // Use the shared socket (connected by StudyRoomPage) — do NOT own the socket lifecycle
        const socket = getSocket()
        if (!socket?.connected) connectSocket()
        socketRef.current = socket || getSocket()
        setupSocketListeners(socketRef.current)
        socketRef.current.emit('join-meeting', { meetingId, userName: userNameRef.current })
        setConnected(true)
        setConnecting(false)
      } catch (err) {
        if (!cancelled) {
          console.error('Video connect error:', err)
          setError('Camera/mic access denied. Please allow permissions.')
          setConnecting(false)
        }
      }
    }

    connectToRoom()
    return () => { cancelled = true; cleanup() }
  }, [meetingId])

  // ========== Sync mic toggle ==========
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMicOn })
      socketRef.current?.emit('media-state', {
        meetingId: activeMeetingRef.current, audio: isMicOn, video: isVideoOn,
      })
    }
  }, [isMicOn])

  // ========== Sync video toggle ==========
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = isVideoOn })
      socketRef.current?.emit('media-state', {
        meetingId: activeMeetingRef.current, audio: isMicOn, video: isVideoOn,
      })
    }
  }, [isVideoOn])

  // ========== Sync screen share ==========
  useEffect(() => {
    if (connected && isScreenSharing) startScreenShare()
    else if (connected && !isScreenSharing && screenStreamRef.current) stopScreenShare()
  }, [isScreenSharing, connected])

  // ========== WebRTC Peer Connection ==========
  const createPeerConnection = useCallback((remoteSocketId, remoteName) => {
    const existingPeer = peersRef.current.get(remoteSocketId)
    if (existingPeer) {
      return existingPeer
    }

    const pc = new RTCPeerConnection(iceConfigRef.current || DEFAULT_ICE_CONFIG)

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current)
      })
    }

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams
      setParticipants(prev => {
        const next = new Map(prev)
        const existing = next.get(remoteSocketId) || {}
        next.set(remoteSocketId, { ...existing, name: remoteName, stream: remoteStream })
        return next
      })
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('ice-candidate', { to: remoteSocketId, candidate: event.candidate })
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn('Peer ' + remoteSocketId + ' connection ' + pc.connectionState)
      }
    }

    peersRef.current.set(remoteSocketId, pc)
    return pc
  }, [])

  const queueIceCandidate = useCallback((remoteSocketId, candidate) => {
    const queued = pendingIceRef.current.get(remoteSocketId) || []
    queued.push(candidate)
    pendingIceRef.current.set(remoteSocketId, queued)
  }, [])

  const flushQueuedIceCandidates = useCallback(async (remoteSocketId) => {
    const pc = peersRef.current.get(remoteSocketId)
    if (!pc || !pc.remoteDescription) return

    const queued = pendingIceRef.current.get(remoteSocketId)
    if (!queued?.length) return

    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.warn('Failed to apply queued ICE candidate:', error)
      }
    }
    pendingIceRef.current.delete(remoteSocketId)
  }, [])

  // ========== Socket listeners ==========
  const setupSocketListeners = useCallback((socket) => {
    // Remove any previous WebRTC listeners to prevent duplicates (critical for React StrictMode)
    socket.off('existing-participants')
    socket.off('user-joined')
    socket.off('offer')
    socket.off('answer')
    socket.off('ice-candidate')
    socket.off('user-left')
    socket.off('media-state')

    socket.on('existing-participants', async (existingUsers) => {
      for (const user of existingUsers) {
        const pc = createPeerConnection(user.socketId, user.name)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('offer', { to: user.socketId, offer })
      }
    })

    socket.on('user-joined', (user) => {
      setParticipants(prev => {
        const next = new Map(prev)
        next.set(user.socketId, { name: user.name, stream: null, audioOn: true, videoOn: true })
        return next
      })
    })

    socket.on('offer', async ({ from, offer, userName: remoteName }) => {
      const pc = createPeerConnection(from, remoteName)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      await flushQueuedIceCandidates(from)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('answer', { to: from, answer })
    })

    socket.on('answer', async ({ from, answer }) => {
      const pc = peersRef.current.get(from)
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        await flushQueuedIceCandidates(from)
      }
    })

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const pc = peersRef.current.get(from)
      if (!pc || !pc.remoteDescription) {
        queueIceCandidate(from, candidate)
        return
      }

      if (pc) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) }
        catch (e) {
          queueIceCandidate(from, candidate)
          console.warn('Failed to add ICE candidate:', e)
        }
      }
    })

    socket.on('user-left', ({ id }) => {
      const pc = peersRef.current.get(id)
      if (pc) { pc.close(); peersRef.current.delete(id) }
      setParticipants(prev => { const next = new Map(prev); next.delete(id); return next })
    })

    socket.on('media-state', ({ from, audio, video }) => {
      setParticipants(prev => {
        const next = new Map(prev)
        const existing = next.get(from)
        if (existing) next.set(from, { ...existing, audioOn: audio, videoOn: video })
        return next
      })
    })
  }, [createPeerConnection, flushQueuedIceCandidates, queueIceCandidate])

  // ========== Screen share ==========
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
      screenStreamRef.current = stream
      const screenTrack = stream.getVideoTracks()[0]

      for (const [, pc] of peersRef.current) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(screenTrack)
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = stream

      screenTrack.onended = () => { stopScreenShare(); onScreenShareChange?.(false) }
      socketRef.current?.emit('screen-share', { meetingId: activeMeetingRef.current, sharing: true })
    } catch (err) {
      console.error('Screen share error:', err)
      onScreenShareChange?.(false)
    }
  }

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop())
      screenStreamRef.current = null
    }
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        for (const [, pc] of peersRef.current) {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video')
          if (sender) sender.replaceTrack(videoTrack)
        }
      }
    }
    socketRef.current?.emit('screen-share', { meetingId: activeMeetingRef.current, sharing: false })
  }

  // ========== Cleanup ==========
  const cleanup = () => {
    for (const [, pc] of peersRef.current) pc.close()
    peersRef.current.clear()
    pendingIceRef.current.clear()
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null }
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null }
    // Clean up WebRTC socket listeners but do NOT disconnect the shared socket
    // (the socket is shared with ChatPanel, TasksPanel, NotesPanel, etc.)
    if (socketRef.current) {
      socketRef.current.off('existing-participants')
      socketRef.current.off('user-joined')
      socketRef.current.off('offer')
      socketRef.current.off('answer')
      socketRef.current.off('ice-candidate')
      socketRef.current.off('user-left')
      socketRef.current.off('media-state')
    }
    socketRef.current = null
    activeMeetingRef.current = null
    setConnected(false)
    setParticipants(new Map())
  }

  // ========== Grid ==========
  const totalParticipants = participants.size + 1
  const gridCols = totalParticipants <= 1 ? 1 : totalParticipants <= 4 ? 2 : totalParticipants <= 9 ? 3 : 4

  // ========== RENDER — pure video display only ==========
  return (
    <div ref={panelRef} className="flex flex-col h-full overflow-hidden bg-gray-900">
      {/* Minimal status bar */}
      <div className="flex items-center justify-between px-3 py-1 shrink-0 bg-gray-900/80">
        <div className="flex items-center gap-2">
          {connected && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
          {connecting && <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />}
          <span className="text-[10px] text-gray-400">
            {connecting ? 'Connecting...' : connected ? totalParticipants + (totalParticipants === 1 ? ' participant' : ' participants') : 'Waiting...'}
          </span>
        </div>
        {connected && (
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <i className="ri-shield-check-line text-green-500" />
            Encrypted
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mb-2 text-xs text-red-400 bg-red-900/30 px-3 py-2 rounded-lg">
          {error}
          <button onClick={() => { setError(''); window.location.reload() }} className="ml-2 underline hover:text-red-300">Retry</button>
        </div>
      )}

      {/* Video Grid */}
      <div className="flex-1 p-2 overflow-hidden">
        <div
          className="w-full h-full gap-2"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(' + gridCols + ', 1fr)', gridAutoRows: '1fr' }}
        >
          {/* Local video (you) */}
          <div className="relative rounded-lg overflow-hidden bg-gray-800 min-h-0">
            <video ref={localVideoRef} autoPlay playsInline muted className={'w-full h-full object-cover' + (!isVideoOn ? ' hidden' : '')} />
            {!isVideoOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-lg font-bold">
                  {userNameRef.current.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            {connecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800/60">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-300">Connecting...</span>
                </div>
              </div>
            )}
            <div className="absolute bottom-1.5 left-1.5">
              <span className="px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-full flex items-center gap-1">
                {userNameRef.current} (You)
                {!isMicOn && <i className="ri-mic-off-fill text-red-400" />}
              </span>
            </div>
          </div>

          {/* Remote participants */}
          {[...participants.entries()].map(([socketId, participant]) => (
            <RemoteVideo key={socketId} participant={participant} />
          ))}
        </div>
      </div>
    </div>
  )
}

function RemoteVideo({ participant }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && participant.stream) videoRef.current.srcObject = participant.stream
  }, [participant.stream])

  return (
    <div className="relative rounded-lg overflow-hidden bg-gray-800 min-h-0">
      {participant.stream && (
        <video ref={videoRef} autoPlay playsInline className={'w-full h-full object-cover' + (participant.videoOn === false ? ' hidden' : '')} />
      )}
      {(!participant.stream || participant.videoOn === false) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white text-lg font-bold">
            {(participant.name || '?').charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5">
        <span className="px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-full flex items-center gap-1">
          {participant.name || 'Peer'}
          {participant.audioOn === false && <i className="ri-mic-off-fill text-red-400" />}
        </span>
      </div>
    </div>
  )
}
