import { useState, useRef, useEffect } from 'react'

export default function AIAssistant() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg = input.trim()
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setInput('')
    setIsTyping(true)

    // Placeholder: simulate AI thinking
    setTimeout(() => {
      setIsTyping(false)
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `This is a placeholder response. Connect your AI backend to get real answers.`
      }])
    }, 1500)
  }

  const clearChat = () => {
    setMessages([])
  }

  return (
    <div className="bg-white border-t border-gray-200 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center">
            <i className="ri-robot-line text-xs text-white" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800">AI Study Assistant</h3>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            <i className="ri-delete-bin-line mr-1" />
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-14 h-14 rounded-full bg-indigo-50 flex items-center justify-center mb-3">
              <i className="ri-robot-line text-2xl text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">AI Study Assistant</p>
            <p className="text-xs text-gray-400 mt-1 max-w-[200px]">Ask questions about your study material, get explanations, or request help</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'gap-2'}`}>
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
                <i className="ri-robot-line text-xs text-white" />
              </div>
            )}
            <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
              msg.role === 'ai'
                ? 'bg-gray-50 text-gray-700 border border-gray-100'
                : 'bg-indigo-600 text-white'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
              <i className="ri-robot-line text-xs text-white" />
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 flex gap-1">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask anything..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shrink-0"
          >
            <i className="ri-send-plane-fill text-sm" />
          </button>
        </div>
      </div>
    </div>
  )
}
