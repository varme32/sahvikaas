import { useState, useEffect, useRef } from 'react'
import { sendVoiceMessage } from '../../../lib/api'

export default function VoiceAssistant({ isOpen, onToggle }) {
  const [status, setStatus] = useState('idle') // idle | listening | processing | speaking
  const [messages, setMessages] = useState([])
  const [language, setLanguage] = useState('en-US')
  const [voiceType, setVoiceType] = useState('default')
  const [transcript, setTranscript] = useState('')
  const scrollRef = useRef(null)
  const recognitionRef = useRef(null)
  const synthRef = useRef(window.speechSynthesis)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Setup speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = language

      recognition.onresult = (event) => {
        const last = event.results[event.results.length - 1]
        setTranscript(last[0].transcript)
        if (last.isFinal) {
          const finalText = last[0].transcript
          setTranscript('')
          handleVoiceInput(finalText)
        }
      }

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        if (event.error === 'no-speech') {
          setStatus('idle')
        } else {
          setMessages(prev => [...prev, { role: 'system', content: `Mic error: ${event.error}. Try again.` }])
          setStatus('idle')
        }
      }

      recognition.onend = () => {
        if (status === 'listening') {
          setStatus('idle')
        }
      }

      recognitionRef.current = recognition
    }
  }, [language])

  const handleVoiceInput = async (text) => {
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setStatus('processing')

    try {
      const data = await sendVoiceMessage(text)
      const aiResponse = data.response
      setMessages(prev => [...prev, { role: 'ai', content: aiResponse }])
      setStatus('speaking')
      speak(aiResponse)
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', content: `⚠️ Error: ${err.message}` }])
      setStatus('idle')
    }
  }

  const speak = (text) => {
    synthRef.current.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = language
    utterance.rate = 1

    // Select voice based on type
    const voices = synthRef.current.getVoices()
    if (voiceType === 'female') {
      const female = voices.find(v => v.name.toLowerCase().includes('female') || v.name.includes('Zira') || v.name.includes('Samantha'))
      if (female) utterance.voice = female
    } else if (voiceType === 'male') {
      const male = voices.find(v => v.name.toLowerCase().includes('male') || v.name.includes('David') || v.name.includes('Alex'))
      if (male) utterance.voice = male
    }

    utterance.onend = () => setStatus('idle')
    utterance.onerror = () => setStatus('idle')
    synthRef.current.speak(utterance)
  }

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      setMessages(prev => [...prev, { role: 'system', content: 'Speech recognition not supported in this browser.' }])
      return
    }

    if (status === 'idle') {
      setStatus('listening')
      recognitionRef.current.lang = language
      recognitionRef.current.start()
    } else if (status === 'listening') {
      recognitionRef.current.stop()
      setStatus('idle')
    } else if (status === 'speaking') {
      synthRef.current.cancel()
      setStatus('idle')
    }
  }

  const handleTextInput = async () => {
    if (!transcript.trim()) return
    const text = transcript.trim()
    setTranscript('')
    await handleVoiceInput(text)
  }

  const buttonBg = {
    idle: 'from-indigo-500 to-green-500',
    listening: 'from-green-400 to-emerald-500',
    processing: 'from-orange-500 to-red-500',
    speaking: 'from-green-500 to-blue-500',
  }

  const statusText = {
    idle: 'Tap the mic to start',
    listening: 'Listening...',
    processing: 'Thinking...',
    speaking: 'Speaking...',
  }

  const statusColor = {
    idle: 'text-gray-500',
    listening: 'text-green-600',
    processing: 'text-yellow-600',
    speaking: 'text-blue-600',
  }

  if (!isOpen) return null

  return (
    <div className="fixed top-14 right-2 sm:right-4 w-[min(350px,calc(100vw-1rem))] max-h-[min(500px,calc(100vh-8rem))] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col z-40 overflow-hidden">
      {/* Header */}
      <div className="bg-[#F2CF7E] px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-white">AI Voice Assistant</h4>
          <span className="text-[10px] px-1.5 py-0.5 bg-white/20 text-white rounded-full">Gemini</span>
        </div>
        <button onClick={onToggle} className="w-6 h-6 rounded flex items-center justify-center text-white/70 hover:text-white">
          <i className="ri-close-line" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[180px] max-h-[260px] scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-center py-6 text-gray-400">
            <i className="ri-mic-line text-2xl" />
            <p className="text-sm mt-1">Tap the mic and ask a question</p>
            <p className="text-xs mt-1">Your voice will be transcribed and answered by AI</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}>
            {msg.role === 'system' ? (
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">{msg.content}</span>
            ) : (
              <div className={`max-w-[85%] px-3 py-2 rounded-lg text-sm ${
                msg.role === 'user'
                  ? 'bg-[#F2CF7E] text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-700 rounded-bl-none'
              }`}>
                {msg.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Transcript preview */}
      {transcript && (
        <div className="px-3 py-1 text-xs text-gray-500 bg-gray-50 border-t border-gray-100 italic">
          "{transcript}"
        </div>
      )}

      {/* Status */}
      <div className={`text-center py-1.5 text-xs font-medium ${statusColor[status]}`}>
        {status === 'listening' && <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />}
        {statusText[status]}
      </div>

      {/* Settings & Controls */}
      <div className="px-3 py-2 border-t border-gray-100 space-y-2 shrink-0">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Language</label>
            <select value={language} onChange={e => setLanguage(e.target.value)} className="w-full h-7 px-2 text-xs border border-gray-200 rounded focus:outline-none">
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
              <option value="hi-IN">Hindi</option>
              <option value="ta-IN">Tamil</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Voice</label>
            <select value={voiceType} onChange={e => setVoiceType(e.target.value)} className="w-full h-7 px-2 text-xs border border-gray-200 rounded focus:outline-none">
              <option value="default">Default</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
        </div>

        <div className="flex justify-center gap-2">
          <button
            onClick={() => { synthRef.current.pause() }}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-xs"
            title="Pause"
          >
            <i className="ri-pause-line" />
          </button>
          <button
            onClick={handleMicClick}
            className={`w-10 h-10 rounded-full bg-gradient-to-r ${buttonBg[status]} text-white flex items-center justify-center shadow-md hover:scale-105 transition-transform ${status === 'listening' ? 'animate-pulse' : ''}`}
          >
            <i className={status === 'listening' ? 'ri-stop-fill' : status === 'processing' ? 'ri-loader-4-line animate-spin' : 'ri-mic-line'} />
          </button>
          <button
            onClick={() => { synthRef.current.cancel(); setStatus('idle') }}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 text-xs"
            title="Stop"
          >
            <i className="ri-stop-line" />
          </button>
        </div>
      </div>
    </div>
  )
}

