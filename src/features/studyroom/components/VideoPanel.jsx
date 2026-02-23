import { useState, useRef, useEffect, useCallback } from 'react'
import { connectSocket, getSocket } from '../../../lib/socket'
import { getWebRtcIceConfig } from '../../../lib/api'

const DEFAULT_ICE_CONFIG = {
  iceServers: [
    // Google STUN servers
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    
    // Metered TURN servers (free, more reliable)
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
    
    // Additional free TURN servers as backup
    {
      urls: 'turn:relay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:relay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:relay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all', // Try all connection types
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
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
        console.log(`🚀 Connecting to room ${meetingId}...`)
        setConnecting(true)
        setError('')

        console.log('📹 Requesting camera and microphone access...')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        })

        if (cancelled) { 
          console.log('❌ Connection cancelled, stopping tracks')
          stream.getTracks().forEach(t => t.stop())
          return 
        }

        console.log('✅ Media stream acquired:', {
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          streamId: stream.id
        })
        
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        stream.getAudioTracks().forEach(t => { t.enabled = isMicOn })
        stream.getVideoTracks().forEach(t => { t.enabled = isVideoOn })

        console.log('🧊 Fetching ICE configuration...')
        try {
          const remoteIceConfig = await getWebRtcIceConfig()
          if (remoteIceConfig?.iceServers?.length) {
            iceConfigRef.current = {
              ...DEFAULT_ICE_CONFIG,
              ...remoteIceConfig,
            }
            console.log('✅ ICE configuration loaded')
          }
        } catch {
          console.log('⚠️ Using default ICE configuration')
          iceConfigRef.current = DEFAULT_ICE_CONFIG
        }

        activeMeetingRef.current = meetingId
        
        // Get socket connection
        console.log('🔌 Getting socket connection...')
        let socket = getSocket()
        
        if (!socket?.connected) {
          console.log('🔌 Socket not connected, connecting...')
          socket = await connectSocket()
        }
        
        socketRef.current = socket
        
        if (!socketRef.current?.connected) {
          console.error('❌ Socket failed to connect after waiting')
          setError('Failed to connect to server. Please refresh.')
          setConnecting(false)
          return
        }
        
        console.log('✅ Socket ready:', socketRef.current.id)
        
        // CRITICAL: Setup listeners BEFORE joining
        setupSocketListeners(socketRef.current)
        
        // Small delay to ensure listeners are registered
        await new Promise(resolve => setTimeout(resolve, 100))
        
        console.log(`📡 Joining meeting ${meetingId} as ${userNameRef.current}`)
        socketRef.current.emit('join-meeting', { meetingId, userName: userNameRef.current })
        
        setConnected(true)
        setConnecting(false)
        console.log('✅ Successfully connected to room')
      } catch (err) {
        if (!cancelled) {
          console.error('❌ Video connect error:', err)
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
    // Check if peer connection already exists
    const existingPeer = peersRef.current.get(remoteSocketId)
    if (existingPeer) {
      console.log(`♻️ Reusing existing peer connection for ${remoteName}`)
      return existingPeer
    }

    console.log(`🆕 Creating new peer connection for ${remoteName} (${remoteSocketId})`)
    
    // Verify we have local stream
    if (!localStreamRef.current) {
      console.error(`❌ Cannot create peer connection for ${remoteName}: No local stream!`)
      return null
    }
    
    const pc = new RTCPeerConnection(iceConfigRef.current || DEFAULT_ICE_CONFIG)

    // Add local tracks to the peer connection
    const tracks = localStreamRef.current.getTracks()
    console.log(`➕ Adding ${tracks.length} tracks to peer connection for ${remoteName}`)
    
    tracks.forEach(track => {
      console.log(`   Adding ${track.kind} track (enabled: ${track.enabled}, readyState: ${track.readyState})`)
      const sender = pc.addTrack(track, localStreamRef.current)
      console.log(`   Sender created:`, sender.track ? 'OK' : 'NO TRACK')
    })

    pc.ontrack = (event) => {
      console.log(`📥 Received ${event.track.kind} track from ${remoteName}`)
      const [remoteStream] = event.streams
      if (remoteStream) {
        console.log(`✅ Setting remote stream for ${remoteName}, stream ID: ${remoteStream.id}`)
        console.log(`   Stream has ${remoteStream.getTracks().length} tracks:`, 
          remoteStream.getTracks().map(t => `${t.kind} (${t.enabled ? 'enabled' : 'disabled'})`))
        
        setParticipants(prev => {
          const next = new Map(prev)
          const existing = next.get(remoteSocketId) || {}
          next.set(remoteSocketId, { 
            ...existing, 
            name: remoteName, 
            stream: remoteStream,
            audioOn: existing.audioOn ?? true,
            videoOn: existing.videoOn ?? true
          })
          console.log(`✅ Updated participant ${remoteName} with stream`)
          return next
        })
      } else {
        console.warn(`⚠️ No remote stream in track event from ${remoteName}`)
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 Sending ICE candidate to ${remoteName}`)
        socketRef.current?.emit('ice-candidate', { to: remoteSocketId, candidate: event.candidate })
      }
    }

    pc.onnegotiationneeded = async () => {
      console.log(`🔄 Negotiation needed for ${remoteName}`)
    }

    pc.oniceconnectionstatechange = () => {
      console.log(`🔌 ICE connection state for ${remoteName}: ${pc.iceConnectionState}`)
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log(`✅ Successfully connected to ${remoteName}`)
      } else if (pc.iceConnectionState === 'failed') {
        console.error(`❌ ICE connection failed for ${remoteName}`)
        console.log(`🔄 Attempting ICE restart for ${remoteName}...`)
        
        // Attempt ICE restart
        setTimeout(async () => {
          try {
            if (pc.signalingState === 'stable') {
              console.log(`   Creating new offer with ICE restart...`)
              const offer = await pc.createOffer({ iceRestart: true })
              await pc.setLocalDescription(offer)
              socketRef.current?.emit('offer', { to: remoteSocketId, offer })
              console.log(`   ICE restart offer sent to ${remoteName}`)
            }
          } catch (err) {
            console.error(`   ICE restart failed:`, err)
          }
        }, 1000)
      } else if (pc.iceConnectionState === 'disconnected') {
        console.warn(`⚠️ ICE connection disconnected for ${remoteName}`)
        console.log(`   Waiting 3 seconds before attempting reconnection...`)
        
        // Wait a bit before trying to reconnect
        setTimeout(() => {
          if (pc.iceConnectionState === 'disconnected') {
            console.log(`   Still disconnected, attempting ICE restart...`)
            pc.restartIce()
          }
        }, 3000)
      }
    }

    pc.onconnectionstatechange = () => {
      console.log(`🔗 Connection state for ${remoteName}: ${pc.connectionState}`)
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.warn(`⚠️ Peer ${remoteSocketId} connection ${pc.connectionState}`)
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
    if (!socket) {
      console.error('❌ Socket is null, cannot setup listeners')
      return
    }
    
    console.log('🔧 Setting up socket listeners...')
    
    // Remove any previous WebRTC listeners to prevent duplicates (critical for React StrictMode)
    socket.off('existing-participants')
    socket.off('user-joined')
    socket.off('offer')
    socket.off('answer')
    socket.off('ice-candidate')
    socket.off('user-left')
    socket.off('media-state')

    socket.on('existing-participants', async (existingUsers) => {
      console.log('📥 Received existing-participants event')
      console.log('   Existing users:', existingUsers)
      console.log('📊 Current state:', {
        hasLocalStream: !!localStreamRef.current,
        localTracks: localStreamRef.current?.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`),
        existingPeers: Array.from(peersRef.current.keys()),
        socketId: socket.id
      })
      
      if (!localStreamRef.current) {
        console.error('❌ No local stream available to create offers!')
        return
      }
      
      if (!existingUsers || existingUsers.length === 0) {
        console.log('ℹ️ No existing users in room, waiting for others to join')
        return
      }
      
      for (const user of existingUsers) {
        try {
          console.log(`🤝 Creating offer for ${user.name} (${user.socketId})`)
          const pc = createPeerConnection(user.socketId, user.name)
          
          if (!pc) {
            console.error(`❌ Failed to create peer connection for ${user.name}`)
            continue
          }
          
          // Verify tracks were added
          const senders = pc.getSenders()
          console.log(`   Peer connection has ${senders.length} senders:`, 
            senders.map(s => s.track ? `${s.track.kind}:${s.track.enabled}` : 'no-track'))
          
          if (senders.length === 0) {
            console.error(`❌ No senders in peer connection for ${user.name}!`)
            continue
          }
          
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          })
          
          console.log(`   Offer created:`, {
            type: offer.type,
            sdpLength: offer.sdp?.length || 0
          })
          
          await pc.setLocalDescription(offer)
          console.log(`   Local description set`)
          
          socket.emit('offer', { to: user.socketId, offer })
          console.log(`✅ Offer sent to ${user.name}`)
        } catch (error) {
          console.error(`❌ Failed to create offer for ${user.name}:`, error)
        }
      }
    })

    socket.on('user-joined', (user) => {
      console.log(`👤 User joined: ${user.name} (${user.socketId})`)
      setParticipants(prev => {
        const next = new Map(prev)
        next.set(user.socketId, { 
          name: user.name, 
          stream: null, 
          audioOn: user.audioOn ?? true, 
          videoOn: user.videoOn ?? true 
        })
        return next
      })
    })

    socket.on('offer', async ({ from, offer, userName: remoteName }) => {
      try {
        console.log(`📥 Received offer event`)
        console.log(`   From: ${remoteName} (${from})`)
        console.log(`   Offer type: ${offer?.type}, SDP length: ${offer?.sdp?.length || 0}`)
        console.log(`   Local stream available: ${!!localStreamRef.current}`)
        
        if (!localStreamRef.current) {
          console.error(`❌ Cannot handle offer: No local stream!`)
          return
        }
        
        const pc = createPeerConnection(from, remoteName)
        
        if (!pc) {
          console.error(`❌ Failed to create peer connection for ${remoteName}`)
          return
        }
        
        console.log(`   Setting remote description...`)
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        console.log(`✅ Remote description set for ${remoteName}`)
        
        await flushQueuedIceCandidates(from)
        
        console.log(`   Creating answer...`)
        const answer = await pc.createAnswer()
        console.log(`   Answer created, setting local description...`)
        await pc.setLocalDescription(answer)
        console.log(`   Sending answer to ${remoteName}...`)
        socket.emit('answer', { to: from, answer })
        console.log(`✅ Answer sent to ${remoteName}`)
      } catch (error) {
        console.error(`❌ Failed to handle offer from ${remoteName || from}:`, error)
      }
    })

    socket.on('answer', async ({ from, answer, userName: remoteName }) => {
      try {
        console.log(`📥 Received answer from ${remoteName || from}`)
        const pc = peersRef.current.get(from)
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
          console.log(`✅ Remote description set from answer for ${remoteName || from}`)
          await flushQueuedIceCandidates(from)
        } else {
          console.warn(`⚠️ No peer connection found for ${from}`)
        }
      } catch (error) {
        console.error(`❌ Failed to handle answer from ${remoteName || from}:`, error)
      }
    })

    socket.on('ice-candidate', async ({ from, candidate }) => {
      const pc = peersRef.current.get(from)
      if (!pc) {
        console.warn(`⚠️ Received ICE candidate from ${from} but no peer connection exists, queuing...`)
        queueIceCandidate(from, candidate)
        return
      }

      if (!pc.remoteDescription) {
        console.log(`⏳ Queuing ICE candidate from ${from} (no remote description yet)`)
        queueIceCandidate(from, candidate)
        return
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
        console.log(`✅ ICE candidate added for ${from}`)
      } catch (e) {
        console.warn(`⚠️ Failed to add ICE candidate from ${from}, queuing:`, e)
        queueIceCandidate(from, candidate)
      }
    })

    socket.on('user-left', ({ id }) => {
      console.log(`👋 User left: ${id}`)
      const pc = peersRef.current.get(id)
      if (pc) { 
        pc.close()
        peersRef.current.delete(id)
        console.log(`🔌 Closed peer connection for ${id}`)
      }
      setParticipants(prev => { 
        const next = new Map(prev)
        next.delete(id)
        return next 
      })
    })

    socket.on('media-state', ({ from, audio, video }) => {
      console.log(`🎤📹 Media state update from ${from}: audio=${audio}, video=${video}`)
      setParticipants(prev => {
        const next = new Map(prev)
        const existing = next.get(from)
        if (existing) {
          next.set(from, { ...existing, audioOn: audio, videoOn: video })
        }
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
            <RemoteVideo key={socketId} participant={participant} socketId={socketId} />
          ))}
        </div>
      </div>
    </div>
  )
}

function RemoteVideo({ participant, socketId }) {
  const videoRef = useRef(null)
  const [hasVideo, setHasVideo] = useState(false)

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      console.log(`🎥 Setting srcObject for ${participant.name} (${socketId})`)
      console.log(`   Stream ID: ${participant.stream.id}`)
      console.log(`   Tracks:`, participant.stream.getTracks().map(t => 
        `${t.kind}:${t.enabled}:${t.readyState}`
      ))
      
      videoRef.current.srcObject = participant.stream
      
      // Force play in case autoplay is blocked
      videoRef.current.play()
        .then(() => {
          console.log(`✅ Video playing for ${participant.name}`)
          setHasVideo(true)
        })
        .catch(err => {
          console.warn(`⚠️ Autoplay blocked for ${participant.name}:`, err)
          // Try to play on user interaction
          videoRef.current.onclick = () => {
            videoRef.current.play()
              .then(() => setHasVideo(true))
              .catch(console.error)
          }
        })
    } else {
      console.log(`⏳ Waiting for stream from ${participant.name} (${socketId})`)
      setHasVideo(false)
    }
  }, [participant.stream, participant.name, socketId])

  const hasStream = !!participant.stream
  const showVideo = hasStream && participant.videoOn !== false

  return (
    <div className="relative rounded-lg overflow-hidden bg-gray-800 min-h-0">
      {hasStream && (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className={'w-full h-full object-cover' + (!showVideo ? ' hidden' : '')} 
        />
      )}
      {(!hasStream || !showVideo) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
          <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white text-lg font-bold mb-2">
            {(participant.name || '?').charAt(0).toUpperCase()}
          </div>
          {!hasStream && (
            <div className="text-xs text-gray-400 animate-pulse">Connecting...</div>
          )}
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5">
        <span className="px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-full flex items-center gap-1">
          {participant.name || 'Peer'}
          {participant.audioOn === false && <i className="ri-mic-off-fill text-red-400" />}
          {!hasStream && <i className="ri-loader-4-line animate-spin text-yellow-400" />}
        </span>
      </div>
    </div>
  )
}
