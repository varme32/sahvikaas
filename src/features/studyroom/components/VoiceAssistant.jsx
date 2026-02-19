import { useState, useEffect, useRef } from 'react'

export default function VoiceAssistant({ isOpen, onToggle }) {
  const [status, setStatus] = useState('idle') // idle | listening | processing | speaking
  const [messages, setMessages] = useState([])
  const [language, setLanguage] = useState('en-US')
  const [voiceType, setVoiceType] = useState('default')
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const buttonBg = {
    idle: 'from-indigo-500 to-green-500',
    listening: 'from-green-400 to-emerald-500',
    processing: 'from-orange-500 to-red-500',
    speaking: 'from-green-500 to-blue-500',
  }

  const statusText = {
    idle: 'Ready to assist you',
    listening: 'Listening...',
    processing: 'Processing...',
    speaking: 'Speaking...',
  }

  const statusColor = {
    idle: 'text-gray-500',
    listening: 'text-green-600',
    processing: 'text-yellow-600',
    speaking: 'text-blue-600',
  }

  const handleMicClick = () => {
    if (status === 'idle') {
      setStatus('listening')
      // Simulate listening
      setTimeout(() => {
        const userMsg = 'What is the time complexity of merge sort?'
        setMessages(prev => [...prev, { role: 'user', content: userMsg }])
        setStatus('processing')
        // Simulate processing
        setTimeout(() => {
          setMessages(prev => [...prev, {
            role: 'ai',
            content: 'The time complexity of merge sort is O(n log n) in all cases — best, average, and worst. It divides the array in half recursively (log n levels) and merges at each level (n operations).'
          }])
          setStatus('speaking')
          setTimeout(() => setStatus('idle'), 3000)
        }, 1500)
      }, 2000)
    } else if (status === 'listening') {
      setStatus('idle')
    }
  }

  if (!isOpen) return null

  return (
        <div className="fixed top-14 right-2 sm:right-4 w-[min(350px,calc(100vw-1rem))] max-h-[min(500px,calc(100vh-8rem))] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-40 overflow-hidden">
          {/* Header */}
          <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">AI Voice Assistant</h4>
            <button
              onClick={onToggle}
              className="w-6 h-6 rounded flex items-center justify-center text-white/70 hover:text-white"
            >
              <i className="ri-close-line" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[280px] scrollbar-thin">
            {messages.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm">Tap the mic to start</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-700 rounded-bl-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
          </div>

          {/* Status */}
          <div className={`text-center py-1.5 text-xs font-medium ${statusColor[status]}`}>
            {statusText[status]}
          </div>

          {/* Settings */}
          <div className="px-3 py-2 border-t border-gray-100 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Language</label>
                <select
                  value={language}
                  onChange={e => setLanguage(e.target.value)}
                  className="w-full h-7 px-2 text-xs border border-gray-200 rounded focus:outline-none"
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Voice Type</label>
                <select
                  value={voiceType}
                  onChange={e => setVoiceType(e.target.value)}
                  className="w-full h-7 px-2 text-xs border border-gray-200 rounded focus:outline-none"
                >
                  <option value="default">Default</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="robot">Robot</option>
                </select>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex justify-center gap-2">
              <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-xs">
                <i className="ri-pause-line" />
              </button>
              <button
                onClick={handleMicClick}
                className={`w-10 h-10 rounded-full bg-gradient-to-r ${buttonBg[status]} text-white flex items-center justify-center shadow-md hover:scale-105 transition-transform`}
              >
                <i className={status === 'listening' ? 'ri-stop-fill' : 'ri-mic-line'} />
              </button>
              <button className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-xs">
                <i className="ri-stop-line" />
              </button>
            </div>
          </div>
        </div>
  )
}
