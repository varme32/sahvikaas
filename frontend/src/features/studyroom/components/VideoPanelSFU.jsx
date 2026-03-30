import { useState, useRef, useEffect, useCallback } from 'react'
import { Device } from 'mediasoup-client'
import { connectSocket, getSocket } from '../../../lib/socket'

export default function VideoPanelSFU({ meetingId, isMicOn, isVideoOn, isScreenSharing, onScreenShareChange, userName }) {
  const [participants, setParticipants] = useState(new Map())
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')

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
  console.log('📱 [VideoPanelSFU] Device detection:', { isMobileDevice, ua: navigator.userAgent.substring(0, 80), maxTouchPoints: navigator.maxTouchPoints })

  const localVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const socketRef = useRef(null)
  const deviceRef = useRef(null)
  const sendTransportRef = useRef(null)
  const recvTransportRef = useRef(null)
  const producersRef = useRef(new Map()) // kind -> producerId
  const consumersRef = useRef(new Map()) // consumerId -> { consumer, stream, peerId }
  const userNameRef = useRef(userName || 'User ' + Math.floor(Math.random() * 1000))

  // ========== AUTO-CONNECT on mount ==========
  useEffect(() => {
    if (!meetingId) return
    let cancelled = false

    const connectToRoom = async () => {
      try {
        console.log(`🎬 [SFU] Connecting to room ${meetingId}...`)
        setConnecting(true)
        setError('')

        // Get local media
        console.log('📹 Requesting camera and microphone...')
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            aspectRatio: { ideal: 16 / 9 },
            facingMode: 'user',
          },
          audio: { echoCancellation: true, noiseSuppression: true },
        })

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        console.log('✅ Media stream acquired')
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        stream.getAudioTracks().forEach(t => { t.enabled = isMicOn })
        stream.getVideoTracks().forEach(t => { t.enabled = isVideoOn })

        // Connect socket
        console.log('🔌 Connecting socket...')
        let socket = getSocket()
        if (!socket?.connected) {
          socket = await connectSocket()
        }
        socketRef.current = socket

        if (!socketRef.current?.connected) {
          throw new Error('Socket failed to connect')
        }

        console.log('✅ Socket connected:', socketRef.current.id)

        // Join room via socket
        socketRef.current.emit('join-meeting', { meetingId, userName: userNameRef.current, isMobile: isMobileDevice })

        // Initialize Mediasoup device
        console.log('🎬 Initializing Mediasoup device...')
        const device = new Device()
        deviceRef.current = device

        // Get router RTP capabilities
        const { rtpCapabilities } = await new Promise((resolve, reject) => {
          socketRef.current.emit('getRouterRtpCapabilities', { roomId: meetingId }, (response) => {
            if (response.error) reject(new Error(response.error))
            else resolve(response)
          })
        })

        console.log('✅ Got router RTP capabilities')

        // Load device with capabilities
        await device.load({ routerRtpCapabilities: rtpCapabilities })
        console.log('✅ Device loaded')

        // Create send transport
        console.log('📤 Creating send transport...')
        const sendTransportData = await new Promise((resolve, reject) => {
          socketRef.current.emit('createWebRtcTransport', { roomId: meetingId, direction: 'send' }, (response) => {
            if (response.error) reject(new Error(response.error))
            else resolve(response.transport)
          })
        })

        const sendTransport = device.createSendTransport(sendTransportData)
        sendTransportRef.current = sendTransport

        sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await new Promise((resolve, reject) => {
              socketRef.current.emit('connectTransport', {
                roomId: meetingId,
                transportId: sendTransport.id,
                dtlsParameters,
              }, (response) => {
                if (response.error) reject(new Error(response.error))
                else resolve()
              })
            })
            callback()
          } catch (error) {
            errback(error)
          }
        })

        sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
          try {
            const { id } = await new Promise((resolve, reject) => {
              socketRef.current.emit('produce', {
                roomId: meetingId,
                transportId: sendTransport.id,
                kind,
                rtpParameters,
                appData,
              }, (response) => {
                if (response.error) reject(new Error(response.error))
                else resolve(response)
              })
            })
            callback({ id })
          } catch (error) {
            errback(error)
          }
        })

        console.log('✅ Send transport created')

        // Create receive transport
        console.log('📥 Creating receive transport...')
        const recvTransportData = await new Promise((resolve, reject) => {
          socketRef.current.emit('createWebRtcTransport', { roomId: meetingId, direction: 'recv' }, (response) => {
            if (response.error) reject(new Error(response.error))
            else resolve(response.transport)
          })
        })

        const recvTransport = device.createRecvTransport(recvTransportData)
        recvTransportRef.current = recvTransport

        recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await new Promise((resolve, reject) => {
              socketRef.current.emit('connectTransport', {
                roomId: meetingId,
                transportId: recvTransport.id,
                dtlsParameters,
              }, (response) => {
                if (response.error) reject(new Error(response.error))
                else resolve()
              })
            })
            callback()
          } catch (error) {
            errback(error)
          }
        })

        console.log('✅ Receive transport created')

        // Produce local tracks
        console.log('📤 Producing local tracks...')
        for (const track of stream.getTracks()) {
          const producer = await sendTransport.produce({ track })
          producersRef.current.set(track.kind, producer.id)
          console.log(`✅ Producing ${track.kind} track:`, producer.id)
        }

        // Setup socket listeners for new producers
        setupSocketListeners()

        // Get existing producers and consume them
        console.log('📥 Getting existing producers...')
        const { producers } = await new Promise((resolve, reject) => {
          socketRef.current.emit('getProducers', { roomId: meetingId }, (response) => {
            if (response.error) reject(new Error(response.error))
            else resolve(response)
          })
        })

        console.log(`✅ Found ${producers.length} existing producers`)
        for (const producer of producers) {
          await consumeProducer(producer.id, producer.peerId, producer.peerName)
        }

        // Send initial media state including isMobile flag
        socketRef.current.emit('media-state', {
          meetingId, audio: isMicOn, video: isVideoOn, isMobile: isMobileDevice,
        })

        setConnected(true)
        setConnecting(false)
        console.log('✅ Successfully connected to SFU room')
      } catch (err) {
        if (!cancelled) {
          console.error('❌ SFU connect error:', err)
          setError(err.message || 'Failed to connect')
          setConnecting(false)
        }
      }
    }

    connectToRoom()
    return () => { cancelled = true; cleanup() }
  }, [meetingId])

  // ========== Consume producer ==========
  const consumeProducer = useCallback(async (producerId, peerId, peerName) => {
    try {
      console.log(`📥 Consuming producer ${producerId} from peer ${peerName || peerId}`)

      const { consumer } = await new Promise((resolve, reject) => {
        socketRef.current.emit('consume', {
          roomId: meetingId,
          transportId: recvTransportRef.current.id,
          producerId,
          rtpCapabilities: deviceRef.current.rtpCapabilities,
        }, (response) => {
          if (response.error) reject(new Error(response.error))
          else resolve(response)
        })
      })

      const consumerObj = await recvTransportRef.current.consume({
        id: consumer.id,
        producerId: consumer.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
      })

      // Resume consumer
      await new Promise((resolve, reject) => {
        socketRef.current.emit('resumeConsumer', {
          roomId: meetingId,
          consumerId: consumer.id,
        }, (response) => {
          if (response.error) reject(new Error(response.error))
          else resolve()
        })
      })

      // Create stream from track
      const stream = new MediaStream([consumerObj.track])

      // Store consumer
      consumersRef.current.set(consumer.id, {
        consumer: consumerObj,
        stream,
        peerId,
        kind: consumer.kind,
      })

      // Update participants
      setParticipants(prev => {
        const next = new Map(prev)
        const existing = next.get(peerId) || { 
          name: peerName || `Peer ${peerId.slice(0, 4)}`,
          streams: {},
          audioOn: true,
          videoOn: true,
        }
        existing.streams = existing.streams || {}
        existing.streams[consumer.kind] = stream
        
        // Combine audio and video streams
        if (existing.streams.video && existing.streams.audio) {
          const combinedStream = new MediaStream([
            ...existing.streams.video.getTracks(),
            ...existing.streams.audio.getTracks(),
          ])
          existing.stream = combinedStream
        } else {
          existing.stream = existing.streams.video || existing.streams.audio
        }
        
        next.set(peerId, existing)
        return next
      })

      console.log(`✅ Consuming ${consumer.kind} from peer ${peerName || peerId}`)
    } catch (error) {
      console.error('❌ Consume error:', error)
    }
  }, [meetingId])

  // ========== Socket listeners ==========
  const setupSocketListeners = useCallback(() => {
    const socket = socketRef.current

    socket.on('newProducer', async ({ producerId, peerId, kind, peerName }) => {
      console.log(`🆕 New producer ${kind} from peer ${peerName || peerId}`)
      await consumeProducer(producerId, peerId, peerName)
    })

    socket.on('producerClosed', ({ producerId }) => {
      console.log(`🔌 Producer closed: ${producerId}`)
      // Find and remove consumer
      for (const [consumerId, data] of consumersRef.current) {
        if (data.consumer.producerId === producerId) {
          data.consumer.close()
          consumersRef.current.delete(consumerId)
          
          // Update participants - remove specific stream
          setParticipants(prev => {
            const next = new Map(prev)
            const participant = next.get(data.peerId)
            if (participant && participant.streams) {
              delete participant.streams[data.kind]
              // Update combined stream
              if (participant.streams.video || participant.streams.audio) {
                const tracks = []
                if (participant.streams.video) tracks.push(...participant.streams.video.getTracks())
                if (participant.streams.audio) tracks.push(...participant.streams.audio.getTracks())
                participant.stream = new MediaStream(tracks)
              } else {
                next.delete(data.peerId)
              }
            }
            return next
          })
        }
      }
    })

    socket.on('user-left', ({ id }) => {
      console.log(`👋 User left: ${id}`)
      setParticipants(prev => {
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    })

    socket.on('media-state', ({ from, audio, video, isMobile }) => {
      console.log(`🎤📹 Media state from ${from}: audio=${audio}, video=${video}, isMobile=${isMobile}`)
      setParticipants(prev => {
        const next = new Map(prev)
        const existing = next.get(from)
        if (existing) {
          next.set(from, { ...existing, audioOn: audio, videoOn: video, isMobile: !!isMobile })
        } else {
          // Create participant if it doesn't exist yet (race condition)
          next.set(from, { name: 'Peer', streams: {}, stream: null, audioOn: audio, videoOn: video, isMobile: !!isMobile })
        }
        console.log('📡 [SFU media-state] from:', from, 'isMobile:', !!isMobile)
        return next
      })
    })
  }, [consumeProducer])

  // ========== Sync mic toggle ==========
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = isMicOn })
    }
  }, [isMicOn])

  // ========== Sync video toggle ==========
  useEffect(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = isVideoOn })
    }
  }, [isVideoOn])

  // ========== Cleanup ==========
  const cleanup = () => {
    console.log('🧹 Cleaning up SFU connection...')
    
    // Close producers
    for (const [kind, producerId] of producersRef.current) {
      socketRef.current?.emit('closeProducer', { roomId: meetingId, producerId })
    }
    producersRef.current.clear()

    // Close consumers
    for (const [consumerId, data] of consumersRef.current) {
      data.consumer.close()
    }
    consumersRef.current.clear()

    // Close transports
    sendTransportRef.current?.close()
    recvTransportRef.current?.close()

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop())
      localStreamRef.current = null
    }

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

  const computeGrid = (count, cW, cH) => {
    if (count <= 0 || cW <= 0 || cH <= 0) return { cols: 1, rows: 1 }
    const aspect = 16 / 9
    let bestCols = 1
    let bestSize = 0
    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols)
      const tileW = cW / cols
      const tileH = cH / rows
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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-900">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1 shrink-0 bg-gray-900/80">
        <div className="flex items-center gap-2">
          {connected && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
          {connecting && <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />}
          <span className="text-[10px] text-gray-400">
            {connecting ? 'Connecting...' : connected ? `${totalParticipants} ${totalParticipants === 1 ? 'participant' : 'participants'} (SFU)` : 'Waiting...'}
          </span>
        </div>
        {connected && (
          <div className="flex items-center gap-1 text-[10px] text-green-500">
            <i className="ri-server-line" />
            SFU Mode
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mx-3 mb-2 text-xs text-red-400 bg-red-900/30 px-3 py-2 rounded-lg">
          {error}
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
          {/* Local video */}
          <div className="relative rounded-xl overflow-hidden bg-gray-800 w-full h-full" style={{ aspectRatio: '16/9', maxHeight: '100%', maxWidth: '100%' }}>
            <video ref={localVideoRef} autoPlay playsInline muted className={'absolute inset-0 w-full h-full' + (!isVideoOn ? ' hidden' : '')} style={{ transform: 'scaleX(-1)', objectFit: 'cover' }} />
            {!isVideoOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#F2CF7E] flex items-center justify-center text-white text-lg sm:text-xl font-bold">
                  {userNameRef.current.charAt(0).toUpperCase()}
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
          {[...participants.entries()].map(([peerId, participant]) => (
            <RemoteVideo key={peerId} participant={participant} peerId={peerId} viewerIsMobile={isMobileDevice} />
          ))}
        </div>
      </div>
    </div>
  )
}

function RemoteVideo({ participant, peerId, viewerIsMobile }) {
  const videoRef = useRef(null)
  const [videoPlaying, setVideoPlaying] = useState(false)

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      console.log(`🎥 Setting stream for peer ${participant.name || peerId}`)
      videoRef.current.srcObject = participant.stream
      
      // Try to play
      videoRef.current.play()
        .then(() => {
          console.log(`✅ Video playing for ${participant.name || peerId}`)
          setVideoPlaying(true)
        })
        .catch(err => {
          console.warn(`⚠️ Autoplay blocked for ${participant.name || peerId}:`, err)
          setVideoPlaying(false)
        })
    } else {
      setVideoPlaying(false)
    }
  }, [participant.stream, participant.name, peerId])

  const hasStream = !!participant.stream
  const showVideo = hasStream && participant.videoOn !== false
  // XOR: flip when exactly one side is mobile
  const needsFlip = !!participant.isMobile !== !!viewerIsMobile
  console.log('🎥 [SFU RemoteVideo]', participant.name, '| sender.isMobile:', !!participant.isMobile, '| viewer.isMobile:', !!viewerIsMobile, '| needsFlip:', needsFlip)

  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-800 w-full h-full" style={{ aspectRatio: '16/9', maxHeight: '100%', maxWidth: '100%' }}>
      {hasStream && (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className={'absolute inset-0 w-full h-full' + (!showVideo ? ' hidden' : '')} 
          style={{ objectFit: 'cover', transform: needsFlip ? 'scaleX(-1)' : 'none' }}
        />
      )}
      {(!hasStream || !showVideo) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-emerald-600 flex items-center justify-center text-white text-lg sm:text-xl font-bold mb-2">
            {(participant.name || 'P').charAt(0).toUpperCase()}
          </div>
          {!hasStream && (
            <div className="text-xs text-gray-400 animate-pulse">Connecting...</div>
          )}
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5">
        <span className="px-2 py-0.5 bg-black/60 text-white text-[10px] rounded-full flex items-center gap-1">
          {participant.name || `Peer ${peerId.slice(0, 4)}`}
          {participant.audioOn === false && <i className="ri-mic-off-fill text-red-400" />}
          {!videoPlaying && hasStream && <i className="ri-loader-4-line animate-spin text-yellow-400" />}
        </span>
      </div>
    </div>
  )
}

