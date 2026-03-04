import { useState, useRef, useEffect } from 'react'
import { sendAIMessage } from '../../../lib/api'

export default function AIAssistant() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const handleSend = async () => {
    if (!input.trim() || isTyping) return
    const userMsg = input.trim()
    setInput('')
    setError('')

    const newMessages = [...messages, { role: 'user', content: userMsg }]
    setMessages(newMessages)
    setIsTyping(true)

    try {
      const data = await sendAIMessage(userMsg, messages)
      setMessages(prev => [...prev, { role: 'ai', content: data.response }])
    } catch (err) {
      setError(err.message)
      setMessages(prev => [...prev, {
        role: 'ai',
        content: `⚠️ Error: ${err.message}. Make sure the backend server is running on port 5000.`
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const clearChat = () => {
    setMessages([])
    setError('')
  }

  const renderContent = (text) => {
    return text.split('\n').map((line, i) => {
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      processed = processed.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono text-indigo-700">$1</code>')
      if (processed.startsWith('- ') || processed.startsWith('* ')) {
        processed = '&nbsp;&nbsp;• ' + processed.slice(2)
      }
      if (processed.startsWith('```')) return <div key={i} className="border-t border-gray-200 my-1" />
      if (processed.trim() === '') return <br key={i} />
      return <p key={i} className="mb-0.5" dangerouslySetInnerHTML={{ __html: processed }} />
    })
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
          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">Gemini</span>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
            <i className="ri-delete-bin-line mr-1" />Clear
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
            <p className="text-xs text-gray-400 mt-1 max-w-[240px]">Powered by Gemini AI. Ask questions, get explanations, solve problems, or request study help.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'gap-2'}`}>
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                <i className="ri-robot-line text-xs text-white" />
              </div>
            )}
            <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
              msg.role === 'ai' ? 'bg-gray-50 text-gray-700 border border-gray-100' : 'bg-indigo-600 text-white'
            }`}>
              <div className="whitespace-pre-wrap leading-relaxed">
                {msg.role === 'ai' ? renderContent(msg.content) : msg.content}
              </div>
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center shrink-0">
              <i className="ri-robot-line text-xs text-white" />
            </div>
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 flex gap-1">
              <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-100 shrink-0">
        {error && <p className="text-xs text-red-500 mb-1.5"><i className="ri-error-warning-line mr-1" />{error}</p>}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask anything..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={isTyping}
            className="flex-1 h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center hover:bg-indigo-700 transition-colors disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed shrink-0"
          >
            <i className={isTyping ? 'ri-loader-4-line animate-spin text-sm' : 'ri-send-plane-fill text-sm'} />
          </button>
        </div>
      </div>
    </div>
  )
}
