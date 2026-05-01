import { useState, useRef, useEffect, useCallback } from 'react'
import { connectSocket, getSocket } from '../../../lib/socket'
import { getWebRtcIceConfig } from '../../../lib/api'

// ─── Constants for connection health monitoring ───
const HEALTH_CHECK_INTERVAL = 8000   // Check peer health every 8s
const RECONNECT_BASE_DELAY = 2000    // Base delay for reconnection backoff
const MAX_RECONNECT_ATTEMPTS = 5     // Max auto-reconnect attempts per peer

const DEFAULT_ICE_CONFIG = {
  iceServers: [
    // Multiple STUN servers for reliability
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Free TURN servers (OpenRelay by Metered - 20GB/month free)
    // UDP on port 80 (bypasses most firewalls)
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    // TCP on port 80 (fallback when UDP is blocked)
    {
      urls: 'turn:openrelay.metered.ca:80?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    // UDP on port 443 (bypasses HTTPS-only firewalls)
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    // TCP on port 443 (most compatible - works through deep packet inspection)
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    // TURNS (TLS) on port 443 (bypasses DPI firewalls that inspect TCP)
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all', // Use both STUN and TURN
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
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
  const negotiatingRef = useRef(new Set()) // Track ongoing negotiations
  const reconnectAttemptsRef = useRef(new Map()) // peerId -> attempt count
  const healthCheckRef = useRef(null) // interval ID for health checks
  const peerNamesRef = useRef(new Map()) // peerId -> name (for reconnection)

  // Keep refs for media state to avoid stale closures in async flows
  const isMicOnRef = useRef(isMicOn)
  const isVideoOnRef = useRef(isVideoOn)
  useEffect(() => { isMicOnRef.current = isMicOn }, [isMicOn])
  useEffect(() => { isVideoOnRef.current = isVideoOn }, [isVideoOn])

  // ========== AUTO-CONNECT on mount ==========
  useEffect(() => {
    if (!meetingId) return
    let cancelled = false

    const connectToRoom = async () => {
      try {
        console.log('🎬 Starting connection to room:', meetingId)
        setConnecting(true)
        setError('')

        // Try to get media with fallback constraints
        let stream = null
        try {
          console.log('📹 Requesting high-quality media...')
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280, min: 640 },
              height: { ideal: 720, min: 480 },
              aspectRatio: { ideal: 16 / 9 },
              facingMode: 'user',
              frameRate: { ideal: 30, min: 15 },
            },
            audio: { 
              echoCancellation: true, 
              noiseSuppression: true,
              autoGainControl: true,
            },
          })
        } catch (highQualityError) {
          console.warn('⚠️ High-quality media failed, trying standard quality:', highQualityError.message)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: 'user',
              },
              audio: true,
            })
          } catch (standardError) {
            console.warn('⚠️ Standard quality failed, trying audio only:', standardError.message)
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: true,
              })
            } catch (audioError) {
              throw new Error('Unable to access camera or microphone')
            }
          }
        }

        if (cancelled) { 
          stream?.getTracks().forEach(t => t.stop())
          return 
        }

        console.log('✅ Media stream acquired:', {
          video: stream.getVideoTracks().length > 0,
          audio: stream.getAudioTracks().length > 0,
        })

        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        
        // Set initial track states using refs to avoid stale closures
        stream.getAudioTracks().forEach(t => { 
          t.enabled = isMicOnRef.current
          console.log(`🎤 Audio track enabled: ${t.enabled}`)
        })
        stream.getVideoTracks().forEach(t => { 
          t.enabled = isVideoOnRef.current
          console.log(`📹 Video track enabled: ${t.enabled}`)
        })

        // Fetch ICE configuration from server
        try {
          console.log('🧶 Fetching ICE configuration...')
          const remoteIceConfig = await getWebRtcIceConfig()
          if (remoteIceConfig?.iceServers?.length) {
            iceConfigRef.current = {
              ...DEFAULT_ICE_CONFIG,
              ...remoteIceConfig,
            }
            console.log('✅ Using server ICE config with', remoteIceConfig.iceServers.length, 'servers')
          } else {
            iceConfigRef.current = DEFAULT_ICE_CONFIG
            console.log('⚠️ Using default ICE config')
          }
        } catch (iceError) {
          console.warn('⚠️ Failed to fetch ICE config, using defaults:', iceError.message)
          iceConfigRef.current = DEFAULT_ICE_CONFIG
        }

        activeMeetingRef.current = meetingId
        
        // Use the shared socket (connected by StudyRoomPage)
        const socket = getSocket()
        if (!socket?.connected) {
          console.log('🔌 Socket not connected, connecting...')
          await connectSocket()
        }
        socketRef.current = socket || getSocket()
        
        // CRITICAL: Set up socket listeners FIRST, then emit join-meeting.
        // This prevents the race condition where 'existing-participants'
        // arrives before the listener is registered.
        console.log('🔧 Setting up socket listeners BEFORE join...')
        setupSocketListeners(socketRef.current)
        
        // Small yield to ensure listeners are registered in the event loop
        await new Promise(r => setTimeout(r, 50))
        
        if (cancelled) return
        
        // Now emit join-meeting — the listeners are guaranteed to be ready
        console.log('📤 Emitting join-meeting event...')
        socketRef.current.emit('join-meeting', { 
          meetingId, 
          userName: userNameRef.current, 
          isMobile: isMobileDevice 
        })
        
        // Send initial media state using refs
        socketRef.current.emit('media-state', {
          meetingId, 
          audio: isMicOnRef.current, 
          video: isVideoOnRef.current, 
          isMobile: isMobileDevice,
        })
        
        setConnected(true)
        setConnecting(false)
        console.log('✅ Successfully connected to room')
      } catch (err) {
        if (!cancelled) {
          console.error('❌ Video connect error:', err)
          setError('Camera/mic access denied. You can still see others.')
          setConnecting(false)

          // Even without camera/mic, set up socket listeners so we can
          // receive remote video and participate in the room
          console.log('⚠️ Connecting without local media...')
          activeMeetingRef.current = meetingId
          const socket = getSocket()
          if (!socket?.connected) await connectSocket()
          socketRef.current = socket || getSocket()
          
          // Set up listeners BEFORE emitting join-meeting
          setupSocketListeners(socketRef.current)
          await new Promise(r => setTimeout(r, 50))
          
          if (cancelled) return
          
          socketRef.current.emit('join-meeting', { 
            meetingId, 
            userName: userNameRef.current, 
            isMobile: isMobileDevice 
          })
          socketRef.current.emit('media-state', {
            meetingId, 
            audio: false, 
            video: false, 
            isMobile: isMobileDevice,
          })
          setConnected(true)
          console.log('✅ Connected without local media')
        }
      }
    }

    connectToRoom()
    return () => { 
      cancelled = true
      cleanup() 
    }
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
  // Auto-reconnect a failed peer: tear down, recreate, re-offer
  const reconnectPeer = useCallback((remoteSocketId) => {
    const remoteName = peerNamesRef.current.get(remoteSocketId) || 'Peer'
    const attempts = reconnectAttemptsRef.current.get(remoteSocketId) || 0
    if (attempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`❌ Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached for ${remoteName}`)
      reconnectAttemptsRef.current.delete(remoteSocketId)
      return
    }

    const delay = RECONNECT_BASE_DELAY * Math.pow(1.5, attempts)
    reconnectAttemptsRef.current.set(remoteSocketId, attempts + 1)
    console.log(`🔄 Scheduling reconnect #${attempts + 1} for ${remoteName} in ${delay}ms`)

    setTimeout(async () => {
      // Tear down old connection
      const oldPc = peersRef.current.get(remoteSocketId)
      if (oldPc) { try { oldPc.close() } catch {} }
      peersRef.current.delete(remoteSocketId)
      pendingIceRef.current.delete(remoteSocketId)
      negotiatingRef.current.delete(remoteSocketId)

      if (!socketRef.current?.connected || !activeMeetingRef.current) return

      try {
        negotiatingRef.current.add(remoteSocketId)
        const pc = createPeerConnection(remoteSocketId, remoteName)
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        await pc.setLocalDescription(offer)
        socketRef.current.emit('offer', { to: remoteSocketId, offer })
        console.log(`✅ Reconnect offer sent to ${remoteName} (attempt ${attempts + 1})`)
      } catch (err) {
        console.error(`❌ Reconnect offer failed for ${remoteName}:`, err)
        negotiatingRef.current.delete(remoteSocketId)
      }
    }, delay)
  }, [])

  const createPeerConnection = useCallback((remoteSocketId, remoteName) => {
    const existingPeer = peersRef.current.get(remoteSocketId)
    if (existingPeer) {
      // Only reuse if still healthy
      const state = existingPeer.connectionState || existingPeer.iceConnectionState
      if (state === 'connected' || state === 'new' || state === 'connecting') {
        console.log(`♻️ Reusing healthy peer connection for ${remoteName} (state: ${state})`)
        return existingPeer
      }
      // Close stale/dead connection
      console.log(`♻️ Closing stale peer connection for ${remoteName} (state: ${state})`)
      try { existingPeer.close() } catch {}
      peersRef.current.delete(remoteSocketId)
    }

    // Store name for reconnection
    peerNamesRef.current.set(remoteSocketId, remoteName)

    console.log(`🔗 Creating new peer connection for ${remoteName} (${remoteSocketId})`)
    const pc = new RTCPeerConnection(iceConfigRef.current || DEFAULT_ICE_CONFIG)

    // Add local tracks immediately
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current)
        console.log(`📤 Added ${track.kind} track to peer ${remoteName}`)
      })
    }

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log(`📥 Received ${event.track.kind} track from ${remoteName}`, {
        streams: event.streams.length,
        trackEnabled: event.track.enabled,
        trackState: event.track.readyState,
      })
      
      // Some browsers don't populate event.streams — create a fallback stream
      let remoteStream = event.streams?.[0]
      if (!remoteStream) {
        console.warn(`⚠️ No stream in ontrack event for ${remoteName}, creating fallback MediaStream`)
        remoteStream = new MediaStream([event.track])
      }
      
      setParticipants(prev => {
        const next = new Map(prev)
        const existing = next.get(remoteSocketId) || {}
        
        // If we already have a stream, add the new track to it
        // (audio and video tracks arrive in separate ontrack events)
        let finalStream = remoteStream
        if (existing.stream && existing.stream.id === remoteStream.id) {
          finalStream = existing.stream // Same stream, tracks auto-added
        } else if (existing.stream && !event.streams?.[0]) {
          // Fallback stream scenario — add track to existing stream
          existing.stream.addTrack(event.track)
          finalStream = existing.stream
        }
        
        next.set(remoteSocketId, { 
          ...existing, 
          name: remoteName, 
          stream: finalStream,
          // Preserve media state
          audioOn: existing.audioOn !== undefined ? existing.audioOn : true,
          videoOn: existing.videoOn !== undefined ? existing.videoOn : true,
          isMobile: existing.isMobile !== undefined ? existing.isMobile : false,
        })
        return next
      })
    }

    // Send ICE candidates to remote peer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('ice-candidate', { to: remoteSocketId, candidate: event.candidate })
      } else {
        console.log(`✅ ICE gathering complete for ${remoteName}`)
      }
    }

    // Monitor connection state — auto-reconnect on failure
    pc.onconnectionstatechange = () => {
      console.log(`🔌 Peer ${remoteName} connection state: ${pc.connectionState}`)
      
      if (pc.connectionState === 'connected') {
        console.log(`✅ Successfully connected to ${remoteName}`)
        // Reset reconnect attempts on successful connection
        reconnectAttemptsRef.current.delete(remoteSocketId)
      } else if (pc.connectionState === 'failed') {
        console.error(`❌ Connection failed with ${remoteName}, scheduling auto-reconnect...`)
        reconnectPeer(remoteSocketId)
      } else if (pc.connectionState === 'disconnected') {
        console.warn(`⚠️ Disconnected from ${remoteName}, waiting for recovery...`)
        // Give 5 seconds for natural recovery before forcing reconnect
        setTimeout(() => {
          const currentPc = peersRef.current.get(remoteSocketId)
          if (currentPc && currentPc.connectionState === 'disconnected') {
            console.warn(`⚠️ ${remoteName} still disconnected after 5s, reconnecting...`)
            reconnectPeer(remoteSocketId)
          }
        }, 5000)
      }
    }

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`🧊 Peer ${remoteName} ICE state: ${pc.iceConnectionState}`)
      
      if (pc.iceConnectionState === 'failed') {
        console.error(`❌ ICE connection failed with ${remoteName}`)
        // Try ICE restart first, if that doesn't work connectionState handler will trigger full reconnect
        try { pc.restartIce() } catch {}
      }
    }

    // Monitor signaling state
    pc.onsignalingstatechange = () => {
      console.log(`📡 Peer ${remoteName} signaling state: ${pc.signalingState}`)
    }

    peersRef.current.set(remoteSocketId, pc)
    return pc
  }, [reconnectPeer])

  const queueIceCandidate = useCallback((remoteSocketId, candidate) => {
    const queued = pendingIceRef.current.get(remoteSocketId) || []
    queued.push(candidate)
    pendingIceRef.current.set(remoteSocketId, queued)
    console.log(`🧊 Queued ICE candidate for ${remoteSocketId} (total: ${queued.length})`)
  }, [])

  const flushQueuedIceCandidates = useCallback(async (remoteSocketId) => {
    const pc = peersRef.current.get(remoteSocketId)
    if (!pc) {
      console.warn(`⚠️ No peer connection found for ${remoteSocketId}`)
      return
    }
    
    if (!pc.remoteDescription) {
      console.warn(`⚠️ No remote description set for ${remoteSocketId}, keeping candidates queued`)
      return
    }

    const queued = pendingIceRef.current.get(remoteSocketId)
    if (!queued?.length) return

    console.log(`🧊 Flushing ${queued.length} queued ICE candidates for ${remoteSocketId}`)
    
    let successCount = 0
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
        successCount++
      } catch (error) {
        console.warn(`⚠️ Failed to apply ICE candidate for ${remoteSocketId}:`, error.message)
      }
    }
    
    console.log(`✅ Applied ${successCount}/${queued.length} ICE candidates for ${remoteSocketId}`)
    pendingIceRef.current.delete(remoteSocketId)
  }, [])

  // ========== Socket listeners ==========
  const setupSocketListeners = useCallback((socket) => {
    console.log('🔧 Setting up socket listeners for WebRTC')
    
    // Remove any previous WebRTC listeners to prevent duplicates (critical for React StrictMode)
    socket.off('existing-participants')
    socket.off('user-joined')
    socket.off('offer')
    socket.off('answer')
    socket.off('ice-candidate')
    socket.off('user-left')
    socket.off('media-state')

    socket.on('existing-participants', async (existingUsers) => {
      console.log(`👥 Received ${existingUsers.length} existing participants`)
      
      for (const user of existingUsers) {
        console.log(`👤 Processing existing participant: ${user.name} (${user.socketId})`)
        
        // Always update participant info (including isMobile) even if already known
        setParticipants(prev => {
          const next = new Map(prev)
          const existing = next.get(user.socketId) || {}
          next.set(user.socketId, { 
            ...existing, 
            name: user.name, 
            audioOn: user.audioOn !== false, 
            videoOn: user.videoOn !== false, 
            isMobile: !!user.isMobile,
            stream: existing.stream || null // Preserve existing stream
          })
          return next
        })
        
        // Check if we're already negotiating with this peer
        if (negotiatingRef.current.has(user.socketId)) {
          console.log(`⏳ Already negotiating with ${user.name}, skipping`)
          continue
        }
        
        // Check if we already have a peer connection
        const existingPc = peersRef.current.get(user.socketId)
        if (existingPc) {
          // If peer connection exists but is not in stable state, close and recreate
          if (existingPc.signalingState !== 'stable') {
            console.log(`♻️ Closing unstable peer connection for ${user.name} (state: ${existingPc.signalingState})`)
            existingPc.close()
            peersRef.current.delete(user.socketId)
            negotiatingRef.current.delete(user.socketId)
          } else {
            console.log(`♻️ Peer connection already exists for ${user.name} in stable state`)
            continue
          }
        }
        
        try {
          negotiatingRef.current.add(user.socketId)
          const pc = createPeerConnection(user.socketId, user.name)
          console.log(`📤 Creating offer for ${user.name}`)
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          })
          await pc.setLocalDescription(offer)
          socket.emit('offer', { to: user.socketId, offer })
          console.log(`✅ Offer sent to ${user.name}`)
        } catch (error) {
          console.error(`❌ Failed to create offer for ${user.name}:`, error)
          negotiatingRef.current.delete(user.socketId)
        }
      }
    })

    socket.on('user-joined', (user) => {
      // Skip if it's ourselves (we handle our own video locally)
      if (user.socketId === socket.id) {
        console.log('👤 Ignoring self join event')
        return
      }
      
      console.log(`👤 New user joined: ${user.name} (${user.socketId}), isMobile: ${!!user.isMobile}`)
      
      setParticipants(prev => {
        const next = new Map(prev)
        const existing = next.get(user.socketId) || {}
        // Merge with existing data to preserve stream from ontrack
        next.set(user.socketId, { 
          ...existing, 
          name: user.name, 
          audioOn: user.audioOn !== false, 
          videoOn: user.videoOn !== false, 
          isMobile: !!user.isMobile,
          stream: existing.stream || null
        })
        return next
      })
    })

    socket.on('offer', async ({ from, offer, userName: remoteName }) => {
      console.log(`📥 Received offer from ${remoteName} (${from})`)
      
      try {
        // Always close any existing non-stable connection and rebuild
        const existingPc = peersRef.current.get(from)
        let pc
        if (existingPc && existingPc.signalingState !== 'stable') {
          console.log(`♻️ Closing non-stable peer for ${remoteName} (state: ${existingPc.signalingState})`)
          try { existingPc.close() } catch {}
          peersRef.current.delete(from)
          negotiatingRef.current.delete(from)
          pc = createPeerConnection(from, remoteName)
        } else if (existingPc && existingPc.signalingState === 'have-local-offer') {
          // Glare resolution: both sides sent offers simultaneously
          // Use lexicographic comparison of socket IDs to determine who yields
          const isPolite = socket.id > from
          if (isPolite) {
            console.log(`🤝 Glare detected with ${remoteName}, we are polite — accepting their offer`)
            try { existingPc.close() } catch {}
            peersRef.current.delete(from)
            negotiatingRef.current.delete(from)
            pc = createPeerConnection(from, remoteName)
          } else {
            console.log(`🤝 Glare detected with ${remoteName}, we are impolite — ignoring their offer`)
            return
          }
        } else {
          pc = createPeerConnection(from, remoteName)
        }
        
        negotiatingRef.current.add(from)
        
        console.log(`📝 Setting remote description (offer) from ${remoteName}`)
        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        
        // Flush any queued ICE candidates now that remote description is set
        await flushQueuedIceCandidates(from)
        
        console.log(`📤 Creating answer for ${remoteName}`)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        socket.emit('answer', { to: from, answer })
        negotiatingRef.current.delete(from)
        console.log(`✅ Answer sent to ${remoteName}`)
      } catch (error) {
        console.error(`❌ Failed to handle offer from ${remoteName}:`, error)
        negotiatingRef.current.delete(from)
      }
    })

    socket.on('answer', async ({ from, answer }) => {
      console.log(`📥 Received answer from ${from}`)
      
      const pc = peersRef.current.get(from)
      if (!pc) {
        console.warn(`⚠️ No peer connection found for ${from}`)
        negotiatingRef.current.delete(from)
        return
      }
      
      // Check signaling state before setting remote description
      if (pc.signalingState !== 'have-local-offer') {
        console.warn(`⚠️ Peer ${from} in wrong state for answer: ${pc.signalingState}, ignoring`)
        negotiatingRef.current.delete(from)
        return
      }
      
      try {
        console.log(`📝 Setting remote description (answer) from ${from}`)
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
        
        console.log(`🧊 Flushing queued ICE candidates for ${from}`)
        await flushQueuedIceCandidates(from)
        
        negotiatingRef.current.delete(from)
        console.log(`✅ Answer processed successfully for ${from}`)
      } catch (error) {
        console.error(`❌ Failed to handle answer from ${from}:`, error)
        negotiatingRef.current.delete(from)
      }
    })

    socket.on('ice-candidate', async ({ from, candidate }) => {
      console.log(`🧊 Received ICE candidate from ${from}`)
      
      const pc = peersRef.current.get(from)
      if (!pc) {
        console.warn(`⚠️ No peer connection for ${from}, queueing candidate`)
        queueIceCandidate(from, candidate)
        return
      }
      
      if (!pc.remoteDescription) {
        console.warn(`⚠️ No remote description for ${from}, queueing candidate`)
        queueIceCandidate(from, candidate)
        return
      }

      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
        console.log(`✅ ICE candidate added for ${from}`)
      } catch (error) {
        console.warn(`⚠️ Failed to add ICE candidate for ${from}, queueing:`, error.message)
        queueIceCandidate(from, candidate)
      }
    })

    socket.on('user-left', ({ id }) => {
      console.log(`👋 User left: ${id}`)
      
      const pc = peersRef.current.get(id)
      if (pc) {
        console.log(`🔌 Closing peer connection for ${id}`)
        pc.close()
        peersRef.current.delete(id)
      }
      
      // Clear queued ICE candidates and negotiation state
      pendingIceRef.current.delete(id)
      negotiatingRef.current.delete(id)
      
      setParticipants(prev => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    })

    socket.on('media-state', ({ from, audio, video, isMobile }) => {
      console.log(`🎤📹 Media state update from ${from}: audio=${audio}, video=${video}, isMobile=${isMobile}`)
      
      setParticipants(prev => {
        const next = new Map(prev)
        const existing = next.get(from)
        if (existing) {
          next.set(from, { ...existing, audioOn: audio, videoOn: video, isMobile: !!isMobile })
        } else {
          // Participant entry may not exist yet (race condition) — create it
          console.warn(`⚠️ Creating participant entry for ${from} from media-state event`)
          next.set(from, { name: 'Peer', stream: null, audioOn: audio, videoOn: video, isMobile: !!isMobile })
        }
        return next
      })
    })
    
    console.log('✅ Socket listeners configured')
  }, [createPeerConnection, flushQueuedIceCandidates, queueIceCandidate])

  // Handle socket reconnection — rebuild all peer connections
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleReconnect = () => {
      if (!activeMeetingRef.current) return
      console.log('🔄 Socket reconnected, rebuilding peer connections...')
      
      // Close all existing peer connections (they used the old socket ID)
      for (const [peerId, pc] of peersRef.current) {
        console.log(`🔌 Closing stale peer connection for ${peerId}`)
        pc.close()
      }
      peersRef.current.clear()
      pendingIceRef.current.clear()
      negotiatingRef.current.clear()
      setParticipants(new Map())
      
      // Re-setup listeners and re-join
      if (socketRef.current) {
        console.log('🔧 Re-setting up socket listeners after reconnect...')
        setupSocketListeners(socketRef.current)
        
        // Small delay to ensure listeners are registered before emitting
        setTimeout(() => {
          if (!socketRef.current?.connected) return
          
          console.log('📤 Re-emitting join-meeting after reconnect...')
          socketRef.current.emit('join-meeting', {
            meetingId: activeMeetingRef.current,
            userName: userNameRef.current,
            isMobile: isMobileDevice,
          })
          
          // Re-send media state using refs to get current values
          socketRef.current.emit('media-state', {
            meetingId: activeMeetingRef.current,
            audio: isMicOnRef.current,
            video: isVideoOnRef.current,
            isMobile: isMobileDevice,
          })
          
          setConnected(true)
          console.log('✅ Reconnection complete')
        }, 100)
      }
    }

    const handleDisconnect = (reason) => {
      console.warn('⚠️ Socket disconnected:', reason)
      setConnected(false)
    }

    const handleConnectError = (error) => {
      console.error('❌ Socket connection error:', error)
    }

    socket.on('connect', handleReconnect)
    socket.on('disconnect', handleDisconnect)
    socket.on('connect_error', handleConnectError)
    
    return () => { 
      socket.off('connect', handleReconnect)
      socket.off('disconnect', handleDisconnect)
      socket.off('connect_error', handleConnectError)
    }
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

  // ========== Connection Health Monitor ==========
  useEffect(() => {
    if (!connected) return

    healthCheckRef.current = setInterval(() => {
      for (const [peerId, pc] of peersRef.current) {
        const state = pc.connectionState || pc.iceConnectionState
        if (state === 'failed' || state === 'closed') {
          const name = peerNamesRef.current.get(peerId) || 'Peer'
          console.warn(`💔 Health check: ${name} is ${state}, triggering reconnect`)
          reconnectPeer(peerId)
        }
      }
    }, HEALTH_CHECK_INTERVAL)

    return () => {
      if (healthCheckRef.current) {
        clearInterval(healthCheckRef.current)
        healthCheckRef.current = null
      }
    }
  }, [connected, reconnectPeer])

  // ========== Cleanup ==========
  const cleanup = () => {
    // Stop health checks
    if (healthCheckRef.current) {
      clearInterval(healthCheckRef.current)
      healthCheckRef.current = null
    }
    for (const [, pc] of peersRef.current) { try { pc.close() } catch {} }
    peersRef.current.clear()
    pendingIceRef.current.clear()
    reconnectAttemptsRef.current.clear()
    peerNamesRef.current.clear()
    negotiatingRef.current.clear()
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
  const [hasStream, setHasStream] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const lastStreamIdRef = useRef(null)

  // Derive stream ID for dependency tracking (stream object reference is unstable)
  const streamId = participant.stream?.id || null

  // Effect to set stream when both video element and stream are available
  useEffect(() => {
    const video = videoRef.current
    const stream = participant.stream
    
    if (!video) return
    
    if (!stream) {
      video.srcObject = null
      setHasStream(false)
      setIsPlaying(false)
      lastStreamIdRef.current = null
      return
    }

    // Always re-assign srcObject — it's cheap and guarantees correctness
    // even when React re-mounts the <video> element
    const isNewStream = lastStreamIdRef.current !== stream.id
    if (video.srcObject !== stream) {
      console.log(`🎥 Setting stream for ${participant.name}`, {
        streamId: stream.id,
        isNew: isNewStream,
        tracks: stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState, muted: t.muted }))
      })
      video.srcObject = stream
    }
    lastStreamIdRef.current = stream.id
    setHasStream(true)

    // Attempt to play with retry for autoplay failures
    const attemptPlay = () => {
      if (!video.paused) {
        setIsPlaying(true)
        return
      }
      const playPromise = video.play()
      if (playPromise) {
        playPromise
          .then(() => {
            setIsPlaying(true)
          })
          .catch(err => {
            console.warn(`⚠️ Autoplay blocked for ${participant.name}:`, err.message)
            setIsPlaying(false)
          })
      }
    }

    // Retry playback multiple times with increasing delays
    const retryTimers = []
    const scheduleRetries = () => {
      ;[500, 1500, 3000].forEach(delay => {
        const t = setTimeout(() => {
          if (video.paused && video.srcObject) {
            console.log(`🔄 Retrying playback for ${participant.name} after ${delay}ms`)
            video.play().then(() => setIsPlaying(true)).catch(() => {})
          }
        }, delay)
        retryTimers.push(t)
      })
    }

    const handleLoadedMetadata = () => attemptPlay()
    const handlePlay = () => setIsPlaying(true)
    const handlePause = () => {
      // Don't treat brief pauses (e.g., track replacement) as stopped
      setTimeout(() => {
        if (video.paused) setIsPlaying(false)
      }, 200)
    }
    const handleError = (e) => {
      console.error(`❌ Video error for ${participant.name}:`, e)
      setIsPlaying(false)
    }

    // Monitor tracks ending (indicates dead stream)
    const trackHandlers = []
    stream.getTracks().forEach(track => {
      const onEnded = () => {
        console.warn(`⚠️ Track ${track.kind} ended for ${participant.name}`)
        // Check if all tracks are ended
        const allEnded = stream.getTracks().every(t => t.readyState === 'ended')
        if (allEnded) {
          setHasStream(false)
          setIsPlaying(false)
          lastStreamIdRef.current = null
        }
      }
      track.addEventListener('ended', onEnded)
      trackHandlers.push({ track, handler: onEnded })
    })

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('error', handleError)

    // Try to play immediately if metadata is already loaded
    if (video.readyState >= 2) {
      attemptPlay()
    }
    // Also schedule retries in case autoplay is initially blocked
    scheduleRetries()

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('error', handleError)
      trackHandlers.forEach(({ track, handler }) => track.removeEventListener('ended', handler))
      retryTimers.forEach(t => clearTimeout(t))
    }
  }, [streamId, participant.name])

  // XOR: flip when exactly one side is mobile.
  // If both are same device type (both mobile or both desktop), no flip.
  // If one is mobile and the other desktop, flip to correct the orientation.
  const needsFlip = !!participant.isMobile !== !!viewerIsMobile
  const showVideo = hasStream && participant.videoOn !== false

  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-800 w-full h-full" style={{ aspectRatio: '16/9', maxHeight: '100%', maxWidth: '100%' }}>
      {/* ALWAYS render <video> so srcObject can be assigned immediately.
          Use CSS visibility instead of conditional rendering to avoid losing the ref. */}
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className={'absolute inset-0 w-full h-full'}
        style={{
          objectFit: 'cover',
          transform: needsFlip ? 'scaleX(-1)' : 'none',
          // Hide via CSS instead of unmounting — keeps srcObject intact
          display: showVideo ? 'block' : 'none',
        }} 
      />
      {(!hasStream || !showVideo) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-emerald-600 flex items-center justify-center text-black text-lg sm:text-xl font-bold">
            {(participant.name || '?').charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      {!isPlaying && hasStream && showVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/60">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-white">Loading video...</span>
          </div>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5">
        <span className="px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-full flex items-center gap-1">
          {participant.name || 'Peer'}
          {participant.audioOn === false && <i className="ri-mic-off-fill text-red-400" />}
          {!isPlaying && hasStream && <i className="ri-loader-4-line animate-spin text-yellow-400" />}
        </span>
      </div>
    </div>
  )
}

