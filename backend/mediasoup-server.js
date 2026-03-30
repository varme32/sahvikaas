import mediasoup from 'mediasoup'

// Mediasoup workers (one per CPU core for load balancing)
let workers = []
let nextWorkerIdx = 0

// Room state: roomId -> { router, transports, producers, consumers, peers }
const rooms = new Map()

// Mediasoup configuration
const config = {
  worker: {
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
    logLevel: 'warn',
    logTags: ['info', 'ice', 'dtls', 'rtp', 'srtp', 'rtcp'],
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 1000,
        },
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 1000,
        },
      },
    ],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || undefined,
      },
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    maxIncomingBitrate: 1500000,
    initialAvailableOutgoingBitrate: 1000000,
  },
}

// Initialize Mediasoup workers
export async function initializeMediasoup() {
  const numWorkers = process.env.MEDIASOUP_WORKERS || 1
  console.log(`🎬 Creating ${numWorkers} Mediasoup worker(s)...`)

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker({
      logLevel: config.worker.logLevel,
      logTags: config.worker.logTags,
      rtcMinPort: config.worker.rtcMinPort,
      rtcMaxPort: config.worker.rtcMaxPort,
    })

    worker.on('died', () => {
      console.error(`❌ Mediasoup worker ${i} died, exiting...`)
      setTimeout(() => process.exit(1), 2000)
    })

    workers.push(worker)
    console.log(`✅ Mediasoup worker ${i} created [PID: ${worker.pid}]`)
  }

  console.log('✅ Mediasoup initialized successfully')
}

// Get next worker (round-robin)
function getWorker() {
  const worker = workers[nextWorkerIdx]
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length
  return worker
}

// Get or create room
async function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    console.log(`🏠 Creating new room: ${roomId}`)
    const worker = getWorker()
    const router = await worker.createRouter({
      mediaCodecs: config.router.mediaCodecs,
    })

    rooms.set(roomId, {
      router,
      transports: new Map(), // transportId -> transport
      producers: new Map(), // producerId -> { producer, peerId }
      consumers: new Map(), // consumerId -> { consumer, peerId }
      peers: new Map(), // peerId -> { transports, producers, consumers }
    })

    console.log(`✅ Room ${roomId} created with router`)
  }

  return rooms.get(roomId)
}

// Get router RTP capabilities
export async function getRouterRtpCapabilities(roomId) {
  const room = await getOrCreateRoom(roomId)
  return room.router.rtpCapabilities
}

// Create WebRTC transport
export async function createWebRtcTransport(roomId, peerId) {
  const room = await getOrCreateRoom(roomId)

  const transport = await room.router.createWebRtcTransport({
    ...config.webRtcTransport,
    appData: { peerId },
  })

  // Store transport
  room.transports.set(transport.id, transport)

  // Initialize peer if not exists
  if (!room.peers.has(peerId)) {
    room.peers.set(peerId, {
      transports: new Set(),
      producers: new Set(),
      consumers: new Set(),
    })
  }
  room.peers.get(peerId).transports.add(transport.id)

  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed' || dtlsState === 'failed') {
      console.log(`🔌 Transport ${transport.id} closed/failed`)
      transport.close()
    }
  })

  transport.on('close', () => {
    console.log(`🔌 Transport ${transport.id} closed`)
  })

  console.log(`✅ WebRTC transport created: ${transport.id}`)

  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
  }
}

// Connect transport
export async function connectTransport(roomId, transportId, dtlsParameters) {
  const room = rooms.get(roomId)
  if (!room) throw new Error('Room not found')

  const transport = room.transports.get(transportId)
  if (!transport) throw new Error('Transport not found')

  await transport.connect({ dtlsParameters })
  console.log(`✅ Transport ${transportId} connected`)
}

// Produce media (send stream to server)
export async function produce(roomId, peerId, transportId, kind, rtpParameters, appData) {
  const room = rooms.get(roomId)
  if (!room) throw new Error('Room not found')

  const transport = room.transports.get(transportId)
  if (!transport) throw new Error('Transport not found')

  const producer = await transport.produce({
    kind,
    rtpParameters,
    appData: { ...appData, peerId },
  })

  // Store producer
  room.producers.set(producer.id, { producer, peerId })
  room.peers.get(peerId).producers.add(producer.id)

  producer.on('transportclose', () => {
    console.log(`🔌 Producer ${producer.id} transport closed`)
    producer.close()
    room.producers.delete(producer.id)
  })

  console.log(`✅ Producer created: ${producer.id} (${kind}) for peer ${peerId}`)

  return { id: producer.id }
}

// Consume media (receive stream from server)
export async function consume(roomId, peerId, transportId, producerId, rtpCapabilities) {
  const room = rooms.get(roomId)
  if (!room) throw new Error('Room not found')

  const transport = room.transports.get(transportId)
  if (!transport) throw new Error('Transport not found')

  const producerData = room.producers.get(producerId)
  if (!producerData) throw new Error('Producer not found')

  const { producer } = producerData

  // Check if can consume
  if (!room.router.canConsume({ producerId, rtpCapabilities })) {
    throw new Error('Cannot consume')
  }

  const consumer = await transport.consume({
    producerId,
    rtpCapabilities,
    paused: false,
    appData: { peerId, producerId },
  })

  // Store consumer
  room.consumers.set(consumer.id, { consumer, peerId })
  room.peers.get(peerId).consumers.add(consumer.id)

  consumer.on('transportclose', () => {
    console.log(`🔌 Consumer ${consumer.id} transport closed`)
    consumer.close()
    room.consumers.delete(consumer.id)
  })

  consumer.on('producerclose', () => {
    console.log(`🔌 Consumer ${consumer.id} producer closed`)
    consumer.close()
    room.consumers.delete(consumer.id)
  })

  console.log(`✅ Consumer created: ${consumer.id} for peer ${peerId}`)

  return {
    id: consumer.id,
    producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters,
    type: consumer.type,
    producerPaused: consumer.producerPaused,
  }
}

// Resume consumer
export async function resumeConsumer(roomId, consumerId) {
  const room = rooms.get(roomId)
  if (!room) throw new Error('Room not found')

  const consumerData = room.consumers.get(consumerId)
  if (!consumerData) throw new Error('Consumer not found')

  await consumerData.consumer.resume()
  console.log(`▶️ Consumer ${consumerId} resumed`)
}

// Pause consumer
export async function pauseConsumer(roomId, consumerId) {
  const room = rooms.get(roomId)
  if (!room) throw new Error('Room not found')

  const consumerData = room.consumers.get(consumerId)
  if (!consumerData) throw new Error('Consumer not found')

  await consumerData.consumer.pause()
  console.log(`⏸️ Consumer ${consumerId} paused`)
}

// Close producer
export async function closeProducer(roomId, producerId) {
  const room = rooms.get(roomId)
  if (!room) throw new Error('Room not found')

  const producerData = room.producers.get(producerId)
  if (!producerData) throw new Error('Producer not found')

  producerData.producer.close()
  room.producers.delete(producerId)
  console.log(`🔌 Producer ${producerId} closed`)
}

// Get all producers in room (for new peer to consume)
export function getProducers(roomId, excludePeerId) {
  const room = rooms.get(roomId)
  if (!room) return []

  const producers = []
  for (const [producerId, { producer, peerId }] of room.producers) {
    if (peerId !== excludePeerId) {
      producers.push({
        id: producerId,
        kind: producer.kind,
        peerId,
      })
    }
  }

  return producers
}

// Clean up peer
export function cleanupPeer(roomId, peerId) {
  const room = rooms.get(roomId)
  if (!room) return

  const peer = room.peers.get(peerId)
  if (!peer) return

  console.log(`🧹 Cleaning up peer ${peerId} from room ${roomId}`)

  // Close all transports
  for (const transportId of peer.transports) {
    const transport = room.transports.get(transportId)
    if (transport) {
      transport.close()
      room.transports.delete(transportId)
    }
  }

  // Close all producers
  for (const producerId of peer.producers) {
    const producerData = room.producers.get(producerId)
    if (producerData) {
      producerData.producer.close()
      room.producers.delete(producerId)
    }
  }

  // Close all consumers
  for (const consumerId of peer.consumers) {
    const consumerData = room.consumers.get(consumerId)
    if (consumerData) {
      consumerData.consumer.close()
      room.consumers.delete(consumerId)
    }
  }

  room.peers.delete(peerId)

  // Clean up empty room
  if (room.peers.size === 0) {
    console.log(`🗑️ Room ${roomId} is empty, closing router`)
    room.router.close()
    rooms.delete(roomId)
  }
}

// Get room stats
export function getRoomStats(roomId) {
  const room = rooms.get(roomId)
  if (!room) return null

  return {
    peers: room.peers.size,
    transports: room.transports.size,
    producers: room.producers.size,
    consumers: room.consumers.size,
  }
}
