import { useState, useRef, useEffect } from 'react'
import { getSocket } from '../../../lib/socket'
import { getSmartReply } from '../../../lib/api'

export default function ChatPanel({ roomId, userName }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isAiReplying, setIsAiReplying] = useState(false)
  const [typingUsers, setTypingUsers] = useState(new Map())
  const scrollRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const socketIdRef = useRef(null)

  // Subscribe to real-time chat events
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    socketIdRef.current = socket.id

    const handleRoomState = (state) => {
      if (state.chatMessages) setMessages(state.chatMessages)
    }

    const handleChatMessage = (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    }

    const handleTyping = ({ userId, userName: typer, isTyping }) => {
      setTypingUsers(prev => {
        const next = new Map(prev)
        if (isTyping) next.set(userId, typer)
        else next.delete(userId)
        return next
      })
    }

    socket.on('room-state', handleRoomState)
    socket.on('chat-message', handleChatMessage)
    socket.on('chat-typing', handleTyping)

    return () => {
      socket.off('room-state', handleRoomState)
      socket.off('chat-message', handleChatMessage)
      socket.off('chat-typing', handleTyping)
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, typingUsers])

  const emitTyping = (isTyping) => {
    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('chat-typing', { meetingId: roomId, isTyping })
    }
  }

  const handleInputChange = (e) => {
    setInput(e.target.value)
    emitTyping(true)
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 2000)
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const text = input.trim()
    setInput('')
    emitTyping(false)

    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('chat-send', { meetingId: roomId, content: text })
    }

    if (text.toLowerCase().includes('@ai')) {
      setIsAiReplying(true)
      try {
        const cleanMsg = text.replace(/@ai/gi, '').trim()
        const chatHistory = messages.filter(m => m.type === 'chat').map(m => ({
          user: m.user, content: m.content,
        }))
        const data = await getSmartReply(cleanMsg, chatHistory)
        if (socket?.connected && roomId) {
          socket.emit('chat-send', { meetingId: roomId, content: `🤖 AI: ${data.response}` })
        }
      } catch (err) {
        setMessages(prev => [...prev, {
          id: 'err-' + Date.now(), type: 'system', content: `AI error: ${err.message}`,
        }])
      } finally {
        setIsAiReplying(false)
      }
    }
  }

  const currentSocketId = socketIdRef.current || getSocket()?.id
  const othersTyping = Array.from(typingUsers.entries())
    .filter(([uid]) => uid !== currentSocketId)
    .map(([, name]) => name)

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700">
            Room Chat
            <span className="ml-2 text-[10px] font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Live</span>
          </h4>
          <span className="text-[10px] text-gray-400">Type @AI to ask the assistant</span>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
            <i className="ri-chat-3-line text-3xl" />
            <p className="text-sm mt-2">No messages yet</p>
            <p className="text-xs mt-1">Start chatting or type <span className="font-medium text-indigo-500">@AI</span> to ask the assistant</p>
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.type === 'system') {
            return (
              <div key={msg.id || i} className="text-center">
                <span className="inline-block px-3 py-1 bg-yellow-50 text-yellow-700 text-xs rounded-full border border-yellow-200">
                  <i className="ri-information-line mr-1" />{msg.content}
                </span>
              </div>
            )
          }
          const isSelf = msg.userId === currentSocketId
          const isAI = msg.content?.startsWith('🤖 AI:')
          return (
            <div key={msg.id || i} className="flex gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${
                isAI ? 'bg-indigo-100 text-indigo-600' : isSelf ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
              }`}>
                {isAI ? <i className="ri-robot-line text-sm" /> : (msg.initials || msg.user?.slice(0, 2)?.toUpperCase() || 'U')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-gray-900">{msg.user || 'User'}</span>
                  {isSelf && <span className="px-1.5 py-0 text-[10px] bg-indigo-100 text-indigo-600 rounded font-medium">You</span>}
                  {isAI && <span className="px-1.5 py-0 text-[10px] bg-green-100 text-green-600 rounded font-medium">AI</span>}
                  <span className="text-[10px] text-gray-400">{msg.time}</span>
                </div>
                <div className={`rounded-lg px-3 py-2 text-sm ${
                  isAI ? 'bg-indigo-50 border border-indigo-100 text-gray-700'
                    : isSelf ? 'bg-blue-50 border border-blue-100 text-gray-700'
                    : 'bg-gray-50 border border-gray-100 text-gray-700'
                }`}>
                  <span className="whitespace-pre-wrap">{isAI ? msg.content.replace('🤖 AI: ', '') : msg.content}</span>
                </div>
              </div>
            </div>
          )
        })}
        {isAiReplying && (
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <i className="ri-robot-line text-sm text-indigo-600" />
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 flex gap-1">
              <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
            </div>
          </div>
        )}
        {othersTyping.length > 0 && (
          <div className="text-xs text-gray-400 italic pl-10">
            {othersTyping.join(', ')} {othersTyping.length === 1 ? 'is' : 'are'} typing...
          </div>
        )}
      </div>

      <div className="p-3 border-t border-gray-100 mt-auto shrink-0">
        <div className="relative">
          <input
            type="text"
            placeholder="Type a message... (use @AI to ask assistant)"
            value={input}
            onChange={handleInputChange}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="w-full h-10 pl-4 pr-12 rounded-full border border-gray-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="absolute right-1 top-1 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400"
          >
            <i className="ri-send-plane-fill text-xs" />
          </button>
        </div>
      </div>
    </div>
  )
}
