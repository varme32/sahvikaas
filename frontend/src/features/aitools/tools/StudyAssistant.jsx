import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../../../lib/api'

export default function StudyAssistant() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([
    { role: 'ai', content: "Hi! I'm your Study Assistant. Ask me anything about your studies!" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return
    
    const userMsg = input.trim()
    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      // Filter out the initial AI greeting from history
      const historyToSend = messages.filter(m => m.role !== 'ai' || messages.indexOf(m) !== 0)
      
      const res = await apiRequest('/api/ai/assistant', {
        method: 'POST',
        body: { message: userMsg, history: historyToSend }
      })
      setMessages([...newMessages, { role: 'ai', content: res.response }])
    } catch (error) {
      console.error('AI Error:', error)
      const isQuota = error.message?.includes('quota') || error.message?.includes('429')
      setMessages([...newMessages, { 
        role: 'ai', 
        content: isQuota 
          ? 'AI quota limit reached. Please wait a minute and try again.' 
          : 'Sorry, something went wrong. Please try again.' 
      }])
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/ai-tools')}
            className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <i className="ri-arrow-left-line text-xl text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Study Assistant</h1>
            <p className="text-sm text-gray-500">Get instant help with any topic</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <i className="ri-chat-smile-2-line text-2xl text-white" />
          </div>
        </div>

        {/* Chat Container */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-lg flex flex-col h-[calc(100vh-200px)]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <i className="ri-send-plane-fill text-xl" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
