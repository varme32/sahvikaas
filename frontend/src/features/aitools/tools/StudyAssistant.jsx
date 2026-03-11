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

  // Clean markdown formatting from AI response
  const cleanMarkdown = (text) => {
    return text
      .replace(/^#{1,6}\s+/gm, '') // Remove headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/`(.+?)`/g, '$1') // Remove inline code
      .replace(/^\s*[-*+]\s+/gm, '• ') // Convert list markers to bullets
      .trim()
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    
    const userMsg = input.trim()
    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const historyToSend = messages.filter(m => m.role !== 'ai' || messages.indexOf(m) !== 0)
      
      const res = await apiRequest('/api/ai/assistant', {
        method: 'POST',
        body: { message: userMsg, history: historyToSend }
      })
      
      // Clean markdown from response
      const cleanedResponse = cleanMarkdown(res.response)
      setMessages([...newMessages, { role: 'ai', content: cleanedResponse }])
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
    <div className="space-y-6">
      {/* Header Section - Full Width */}
      <div className="bg-[#F2CF7E] border-y border-[#e0bd6c] py-6 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 shadow-sm">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <button onClick={() => navigate('/ai-tools')} className="w-10 h-10 rounded-lg bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors">
            <i className="ri-arrow-left-line text-xl text-black" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-black">Study Assistant</h1>
            <p className="text-sm text-black/80 mt-1">Get instant help with any topic</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-black/10 flex items-center justify-center">
            <i className="ri-chat-smile-2-line text-xl text-black" />
          </div>
        </div>
      </div>

      {/* Main Content - Centered */}
      <div className="max-w-4xl mx-auto">
        {/* Chat Container */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col h-[calc(100vh-250px)]">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[#F2CF7E] text-black font-medium rounded-br-md'
                    : 'bg-white text-gray-800 rounded-bl-md border border-gray-200'
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

          {/* Input Footer */}
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E]">
            <div className="flex gap-3">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="w-12 h-12 rounded-lg bg-[#F2CF7E] text-black flex items-center justify-center hover:bg-[#e0bd6c] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-md"
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
