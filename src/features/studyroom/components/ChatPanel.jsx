import { useState, useRef, useEffect } from 'react'

export default function ChatPanel() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return
    setMessages(prev => [...prev, {
      type: 'chat',
      user: 'You',
      initials: 'U',
      content: input.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSelf: true,
    }])
    setInput('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-8">
            <i className="ri-chat-3-line text-3xl" />
            <p className="text-sm mt-2">No messages yet</p>
            <p className="text-xs mt-1">Start the conversation...</p>
          </div>
        )}
        {messages.map((msg, i) => {
          if (msg.type === 'system') {
            return (
              <div key={i} className="text-center">
                <span className="inline-block px-3 py-1 bg-yellow-50 text-yellow-700 text-xs rounded-full border border-yellow-200">
                  <i className="ri-information-line mr-1" />
                  {msg.content}
                </span>
              </div>
            )
          }
          return (
            <div key={i} className="flex gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${
                msg.isSelf ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-600'
              }`}>
                {msg.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-gray-900">{msg.user}</span>
                  {msg.isSelf && (
                    <span className="px-1.5 py-0 text-[10px] bg-indigo-100 text-indigo-600 rounded font-medium">You</span>
                  )}
                  <span className="text-[10px] text-gray-400">{msg.time}</span>
                </div>
                <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700">
                  {msg.content}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 mt-auto">
        <div className="relative">
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="w-full h-10 pl-4 pr-12 rounded-full border border-gray-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={handleSend}
            className="absolute right-1 top-1 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 transition-colors"
          >
            <i className="ri-send-plane-fill text-xs" />
          </button>
        </div>
      </div>
    </div>
  )
}
