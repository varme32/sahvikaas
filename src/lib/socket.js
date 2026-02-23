import { io } from 'socket.io-client'

const SOCKET_URL = 'https://sahvikaas.onrender.com'

let socket = null

export function getSocket() {
  if (!socket) {
    console.log('🔌 Creating new socket instance')
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
    })
    
    // Add connection event listeners for debugging
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id)
    })
    
    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error)
    })
    
    socket.on('disconnect', (reason) => {
      console.warn('⚠️ Socket disconnected:', reason)
    })
  }
  return socket
}

export function connectSocket() {
  const s = getSocket()
  if (!s.connected) {
    console.log('🔌 Connecting socket to', SOCKET_URL)
    s.connect()
    
    // Return a promise that resolves when connected
    return new Promise((resolve) => {
      if (s.connected) {
        resolve(s)
        return
      }
      
      const onConnect = () => {
        s.off('connect', onConnect)
        resolve(s)
      }
      
      s.on('connect', onConnect)
      
      // Timeout after 10 seconds
      setTimeout(() => {
        s.off('connect', onConnect)
        resolve(s) // Resolve anyway to not block
      }, 10000)
    })
  }
  return Promise.resolve(s)
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect()
  }
}
