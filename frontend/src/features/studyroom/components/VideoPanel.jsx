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
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Detect if this user is on a mobile device (robust detection)
  const isMobileDevice = (() => {
    const ua = navigator.userAgent
    // Standard mobile user agent check
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true
    // iPadOS 13+ reports as Macintosh but has touch
    if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return true
    // Chrome User-Agent Client Hints API (Chromium 90+)
    if (navigator.userAgentData?.mobile === true) return true
    return false
  })()
  console.log('📱 [VideoPanel] Device detection:', { isMobileDevice, ua: navigator.userAgent.substring(0, 80), maxTouchPoints: navigator.maxTouchPoints })

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
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 16 / 9 },
            facingMode: 'user',
          },
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
        // Re-emit join-meeting so server re-sends existing-participants to our newly
        // registered listeners. The backend handles duplicate joins gracefully.
        socketRef.current.emit('join-meeting', { meetingId, userName: userNameRef.current, isMobile: isMobileDevice })
        // Send initial media state including isMobile flag
        socketRef.current.emit('media-state', {
          meetingId, audio: isMicOn, video: isVideoOn, isMobile: isMobileDevice,
        })
        setConnected(true)
        setConnecting(false)
      } catch (err) {
        if (!cancelled) {
          console.error('Video connect error:', err)
          setError('Camera/mic access denied. You can still see others.')
          setConnecting(false)

          // Even without camera/mic, set up socket listeners so we can
          // receive remote video and participate in the room
          activeMeetingRef.current = meetingId
          const socket = getSocket()
          if (!socket?.connected) connectSocket()
          socketRef.current = socket || getSocket()
          setupSocketListeners(socketRef.current)
          socketRef.current.emit('join-meeting', { meetingId, userName: userNameRef.current, isMobile: isMobileDevice })
          socketRef.current.emit('media-state', {
            meetingId, audio: isMicOn, video: isVideoOn, isMobile: isMobileDevice,
          })
          setConnected(true)
        }
      }
    }

    connectToRoom()
    return () => { cancelled = true; cleanup() }
  }, [meetingId])

  // (reconnect useEffect moved after setupSocketListeners definition)

  // ========== Sync mic toggle ==========
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMicOn })
      socketRef.current?.emit('media-state', {
        meetingId: activeMeetingRef.current, audio: isMicOn, video: isVideoOn, isMobile: isMobileDevice,
      })
    }
  }, [isMicOn])

  // ========== Sync video toggle ==========
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = isVideoOn })
      socketRef.current?.emit('media-state', {
        meetingId: activeMeetingRef.current, audio: isMicOn, video: isVideoOn, isMobile: isMobileDevice,
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
        // Always update participant info (including isMobile) even if already known
        setParticipants(prev => {
          const next = new Map(prev)
          const existing = next.get(user.socketId) || {}
          next.set(user.socketId, { ...existing, name: user.name, audioOn: user.audioOn !== false, videoOn: user.videoOn !== false, isMobile: !!user.isMobile })
          // Preserve stream if already set by ontrack
          if (!existing.stream) next.get(user.socketId).stream = null
          return next
        })
        console.log('👥 [existing-participants] user:', user.name, 'isMobile:', !!user.isMobile)
        // Skip peer connection creation if we already have one
        if (peersRef.current.has(user.socketId)) continue
        const pc = createPeerConnection(user.socketId, user.name)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('offer', { to: user.socketId, offer })
      }
    })

    socket.on('user-joined', (user) => {
      // Skip if it's ourselves (we handle our own video locally)
      if (user.socketId === socket.id) return
      console.log('👤 [user-joined]', user.name, 'isMobile:', !!user.isMobile)
      setParticipants(prev => {
        const next = new Map(prev)
        const existing = next.get(user.socketId) || {}
        // Merge with existing data to preserve stream from ontrack
        next.set(user.socketId, { ...existing, name: user.name, audioOn: true, videoOn: true, isMobile: !!user.isMobile })
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

    socket.on('media-state', ({ from, audio, video, isMobile }) => {
      setParticipants(prev => {
        const next = new Map(prev)
        const existing = next.get(from)
        if (existing) {
          next.set(from, { ...existing, audioOn: audio, videoOn: video, isMobile: !!isMobile })
        } else {
          // Participant entry may not exist yet (race condition) — create it
          next.set(from, { name: 'Peer', stream: null, audioOn: audio, videoOn: video, isMobile: !!isMobile })
        }
        return next
      })
    })
  }, [createPeerConnection, flushQueuedIceCandidates, queueIceCandidate])

  // Handle socket reconnection — rebuild all peer connections
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleReconnect = () => {
      if (!activeMeetingRef.current) return
      console.log('VideoPanel: socket reconnected, rebuilding peers...')
      // Close all existing peer connections (they used the old socket ID)
      for (const [, pc] of peersRef.current) pc.close()
      peersRef.current.clear()
      pendingIceRef.current.clear()
      setParticipants(new Map())
      // Re-setup listeners and re-join
      if (socketRef.current) {
        setupSocketListeners(socketRef.current)
        socketRef.current.emit('join-meeting', {
          meetingId: activeMeetingRef.current,
          userName: userNameRef.current,
          isMobile: isMobileDevice,
        })
      }
    }

    socket.on('connect', handleReconnect)
    return () => { socket.off('connect', handleReconnect) }
  }, [setupSocketListeners])

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

  // ========== Dynamic Grid (Google Meet style) ==========
  const totalParticipants = participants.size + 1
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const gridContainerRef = useRef(null)

  useEffect(() => {
    const el = gridContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width, height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Compute optimal grid cols/rows to best-fill the available area with 16:9 tiles
  const computeGrid = (count, cW, cH) => {
    if (count <= 0 || cW <= 0 || cH <= 0) return { cols: 1, rows: 1 }
    const aspect = 16 / 9
    let bestCols = 1
    let bestSize = 0
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols)
      const tileW = cW / cols
      const tileH = cH / rows
      // The tile is constrained by aspect ratio — pick the smaller dimension
      const w = Math.min(tileW, tileH * aspect)
      const h = w / aspect
      const size = w * h
      if (size > bestSize) {
        bestSize = size
        bestCols = cols
      }
    }
    return { cols: bestCols, rows: Math.ceil(count / bestCols) }
  }

  const { cols: gridCols, rows: gridRows } = computeGrid(
    totalParticipants,
    containerSize.width,
    containerSize.height
  )

  // ========== Fullscreen ==========
  const toggleFullscreen = () => {
    if (!panelRef.current) return
    
    if (!document.fullscreenElement) {
      panelRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true)
      }).catch(err => {
        console.error('Fullscreen error:', err)
      })
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false)
      })
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // ========== RENDER � pure video display only ==========
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
        <div className="flex items-center gap-2">
          {connected && (
            <div className="flex items-center gap-1 text-[10px] text-gray-500">
              <i className="ri-shield-check-line text-green-500" />
              Encrypted
            </div>
          )}
          <button
            onClick={toggleFullscreen}
            className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            <i className={`${isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'} text-gray-400 text-sm`} />
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mb-2 text-xs text-red-400 bg-red-900/30 px-3 py-2 rounded-lg">
          {error}
          <button onClick={() => { setError(''); window.location.reload() }} className="ml-2 underline hover:text-red-300">Retry</button>
        </div>
      )}

      {/* Video Grid */}
      <div ref={gridContainerRef} className="flex-1 p-2 overflow-hidden flex items-center justify-center">
        <div
          className="gap-1.5 sm:gap-2"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gridTemplateRows: `repeat(${gridRows}, 1fr)`,
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            alignItems: 'center',
            justifyItems: 'center',
          }}
        >
          {/* Local video (you) */}
          <div className="relative rounded-xl overflow-hidden bg-gray-800 w-full h-full" style={{ aspectRatio: '16/9', maxHeight: '100%', maxWidth: '100%' }}>
            <video ref={localVideoRef} autoPlay playsInline muted className={'absolute inset-0 w-full h-full' + (!isVideoOn ? ' hidden' : '')} style={{ transform: 'scaleX(-1)', objectFit: 'cover' }} />
            {!isVideoOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#F2CF7E] flex items-center justify-center text-black text-lg sm:text-xl font-bold">
                  {userNameRef.current.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            {connecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800/60">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-2 border-[#F2CF7E] border-t-transparent rounded-full animate-spin" />
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
            <RemoteVideo key={socketId} participant={participant} viewerIsMobile={isMobileDevice} />
          ))}
        </div>
      </div>
    </div>
  )
}

function RemoteVideo({ participant, viewerIsMobile }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && participant.stream) videoRef.current.srcObject = participant.stream
  }, [participant.stream])

  // XOR: flip when exactly one side is mobile.
  // If both are same device type (both mobile or both desktop), no flip.
  // If one is mobile and the other desktop, flip to correct the orientation.
  const needsFlip = !!participant.isMobile !== !!viewerIsMobile
  console.log('🎥 [RemoteVideo]', participant.name, '| sender.isMobile:', !!participant.isMobile, '| viewer.isMobile:', !!viewerIsMobile, '| needsFlip:', needsFlip)

  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-800 w-full h-full" style={{ aspectRatio: '16/9', maxHeight: '100%', maxWidth: '100%' }}>
      {participant.stream && (
        <video ref={videoRef} autoPlay playsInline className={'absolute inset-0 w-full h-full' + (participant.videoOn === false ? ' hidden' : '')} style={{ objectFit: 'cover', transform: needsFlip ? 'scaleX(-1)' : 'none' }} />
      )}
      {(!participant.stream || participant.videoOn === false) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-emerald-600 flex items-center justify-center text-black text-lg sm:text-xl font-bold">
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

