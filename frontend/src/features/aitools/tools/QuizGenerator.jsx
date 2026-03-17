import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../../../lib/api'

export default function QuizGenerator() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('select') // 'select', 'solo', 'host', 'participant'
  const [creationMode, setCreationMode] = useState('ai') // 'ai' or 'manual'
  const [topic, setTopic] = useState('')
  const [numQuestions, setNumQuestions] = useState(10)
  const [difficulty, setDifficulty] = useState('medium')
  const [file, setFile] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showResults, setShowResults] = useState(false)
  
  // Host-specific state
  const [quizCode, setQuizCode] = useState('')
  const [quizStarted, setQuizStarted] = useState(false)
  const [participants, setParticipants] = useState([])
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [timeLimit, setTimeLimit] = useState(0) // 0 = no limit, otherwise seconds per question
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [overallTimeLimit, setOverallTimeLimit] = useState(0) // 0 = no limit, otherwise total minutes for quiz
  const [overallTimeRemaining, setOverallTimeRemaining] = useState(0)
  
  // Participant-specific state
  const [joinCode, setJoinCode] = useState('')
  const [participantName, setParticipantName] = useState('')
  const [isJoined, setIsJoined] = useState(false)
  
  // Manual question creation
  const [manualQuestions, setManualQuestions] = useState([])
  const [currentManualQ, setCurrentManualQ] = useState({
    question: '',
    options: ['', '', '', ''],
    correct: 0,
    explanation: ''
  })

  // Render question text — splits out fenced code blocks for proper display
  const renderQuestion = (text) => {
    if (!text) return null
    const parts = text.split(/(```[\w]*\n[\s\S]*?```)/g)
    return parts.map((part, i) => {
      const codeMatch = part.match(/^```([\w]*)\n([\s\S]*?)```$/)
      if (codeMatch) {
        return (
          <pre key={i} className="mt-3 mb-2 bg-gray-900 text-green-300 rounded-lg p-4 text-sm font-mono overflow-x-auto whitespace-pre leading-relaxed">
            <code>{codeMatch[2]}</code>
          </pre>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  const generateQuizCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const addManualQuestion = () => {
    if (!currentManualQ.question.trim() || currentManualQ.options.some(opt => !opt.trim())) {
      alert('Please fill in all fields')
      return
    }
    setManualQuestions([...manualQuestions, { ...currentManualQ }])
    setCurrentManualQ({
      question: '',
      options: ['', '', '', ''],
      correct: 0,
      explanation: ''
    })
  }

  const removeManualQuestion = (index) => {
    setManualQuestions(manualQuestions.filter((_, i) => i !== index))
  }

  // Register quiz code with backend so participants can fetch questions
  const registerQuizCode = async (code, qs) => {
    try {
      await apiRequest('/api/quiz/register', {
        method: 'POST',
        body: { code, questions: qs, hostName: 'Host', timeLimit }
      })
    } catch (e) {
      console.error('Failed to register quiz code', e)
    }
  }

  const finalizeManualQuiz = async () => {
    if (manualQuestions.length === 0) {
      alert('Please add at least one question')
      return
    }
    setQuestions(manualQuestions)
    if (mode === 'host') {
      const code = generateQuizCode()
      setQuizCode(code)
      setQuizStarted(false)
      await registerQuizCode(code, manualQuestions)
    } else {
      setCurrentQ(0)
      setAnswers({})
      setShowResults(false)
    }
  }

  const handleGenerate = async () => {
    if (!topic && !file) return
    setLoading(true)
    try {
      const formData = new FormData()
      if (file) formData.append('pdf', file)
      formData.append('topic', topic)
      formData.append('numQuestions', numQuestions)
      formData.append('difficulty', difficulty)
      
      const res = await apiRequest('/api/ai/quiz', {
        method: 'POST',
        body: formData
      })
      const qs = res.questions || []
      setQuestions(qs)
      
      if (mode === 'host') {
        const code = generateQuizCode()
        setQuizCode(code)
        setQuizStarted(false)
        await registerQuizCode(code, qs)
      } else {
        setCurrentQ(0)
        setAnswers({})
        setShowResults(false)
      }
    } catch (error) {
      alert('Failed to generate quiz. Please try again.')
    }
    setLoading(false)
  }

  const handleStartQuiz = () => {
    setQuizStarted(true)
    setCurrentQ(0)
    setAnswers({})
    setShowResults(false)
    if (timeLimit > 0) {
      setTimeRemaining(timeLimit)
    }
    if (overallTimeLimit > 0) {
      setOverallTimeRemaining(overallTimeLimit * 60) // Convert minutes to seconds
    }
  }

  // Host management state
  const [editingScore, setEditingScore] = useState(null) // participantName being edited
  const [editScoreValue, setEditScoreValue] = useState('')
  const [hostPolling, setHostPolling] = useState(false)
  const [activeTab, setActiveTab] = useState('leaderboard') // 'leaderboard' | 'questions'

  // Poll leaderboard as host (live updates when participants submit)
  useEffect(() => {
    if (!hostPolling || !quizCode) return
    const interval = setInterval(async () => {
      try {
        const res = await apiRequest(`/api/quiz/results/${quizCode}`)
        if (res.results) {
          setParticipants(res.results.map(r => ({
            name: r.participantName, score: r.score, total: r.total,
            percentage: r.percentage, completedAt: r.submittedAt
          })))
        }
      } catch (e) { /* ignore */ }
    }, 4000)
    return () => clearInterval(interval)
  }, [hostPolling, quizCode])

  const handleHostStartManaging = () => {
    setQuizStarted(true)
    setHostPolling(true)
  }

  const handleEditScore = async (participantName) => {
    const newScore = parseInt(editScoreValue)
    const p = participants.find(p => p.name === participantName)
    if (isNaN(newScore) || newScore < 0 || newScore > p.total) return
    try {
      const res = await apiRequest(`/api/quiz/results/${quizCode}/${encodeURIComponent(participantName)}`, {
        method: 'PATCH', body: { score: newScore }
      })
      if (res.results) setParticipants(res.results.map(r => ({
        name: r.participantName, score: r.score, total: r.total,
        percentage: r.percentage, completedAt: r.submittedAt
      })))
    } catch (e) { alert('Failed to update score') }
    setEditingScore(null)
    setEditScoreValue('')
  }

  const handleRemoveResponse = async (participantName) => {
    if (!confirm(`Remove ${participantName}'s response?`)) return
    try {
      const res = await apiRequest(`/api/quiz/results/${quizCode}/${encodeURIComponent(participantName)}`, {
        method: 'DELETE'
      })
      if (res.results) setParticipants(res.results.map(r => ({
        name: r.participantName, score: r.score, total: r.total,
        percentage: r.percentage, completedAt: r.submittedAt
      })))
    } catch (e) { alert('Failed to remove response') }
  }
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [leaderboardPolling, setLeaderboardPolling] = useState(false)

  // Poll leaderboard after participant submits
  useEffect(() => {
    if (!leaderboardPolling || !joinCode) return
    const interval = setInterval(async () => {
      try {
        const res = await apiRequest(`/api/quiz/results/${joinCode.toUpperCase()}`)
        if (res.results) {
          setParticipants(res.results.map(r => ({
            name: r.participantName,
            score: r.score,
            total: r.total,
            percentage: r.percentage,
            completedAt: r.submittedAt
          })))
        }
      } catch (e) { /* ignore */ }
    }, 5000)
    return () => clearInterval(interval)
  }, [leaderboardPolling, joinCode])

  const handleJoinQuiz = async () => {
    if (!participantName.trim() || joinCode.length !== 6) return
    setJoinLoading(true)
    setJoinError('')
    try {
      const res = await apiRequest(`/api/quiz/join/${joinCode.toUpperCase()}`)
      setQuestions(res.questions || [])
      if (res.timeLimit > 0) {
        setTimeLimit(res.timeLimit)
        setTimeRemaining(res.timeLimit)
      }
      setCurrentQ(0)
      setAnswers({})
      setShowResults(false)
      setIsJoined(true)
    } catch (err) {
      setJoinError(err.message || 'Quiz not found. Check the code and try again.')
    }
    setJoinLoading(false)
  }

  const handleAnswer = (qIndex, optionIndex) => {
    setAnswers({ ...answers, [qIndex]: optionIndex })
  }

  const handleNextQuestion = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1)
      if (timeLimit > 0) {
        setTimeRemaining(timeLimit)
      }
    }
  }

  const handleSubmit = async () => {
    const finalScore = Object.entries(answers).filter(([qIdx, ans]) => 
      questions[qIdx]?.correct === ans
    ).length
    
    if (mode === 'participant') {
      const pct = Math.round((finalScore / questions.length) * 100)
      // Post result to backend so host leaderboard updates
      try {
        const res = await apiRequest(`/api/quiz/submit/${joinCode.toUpperCase()}`, {
          method: 'POST',
          body: { participantName, score: finalScore, total: questions.length, percentage: pct }
        })
        // Update local leaderboard from server response
        if (res.results) {
          setParticipants(res.results.map(r => ({
            name: r.participantName,
            score: r.score,
            total: r.total,
            percentage: r.percentage,
            completedAt: r.submittedAt
          })))
        }
        // Start polling for live leaderboard updates
        setLeaderboardPolling(true)
      } catch (e) {
        // Still show results even if submit fails
      }
    }
    
    setShowResults(true)
  }

  const score = Object.entries(answers).filter(([qIdx, ans]) => 
    questions[qIdx]?.correct === ans
  ).length

  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score)
  
  const quizStats = {
    totalParticipants: participants.length,
    averageScore: participants.length > 0 
      ? (participants.reduce((sum, p) => sum + p.score, 0) / participants.length).toFixed(1)
      : 0,
    highestScore: participants.length > 0 ? Math.max(...participants.map(p => p.score)) : 0,
    lowestScore: participants.length > 0 ? Math.min(...participants.map(p => p.score)) : 0,
    passRate: participants.length > 0
      ? Math.round((participants.filter(p => p.percentage >= 60).length / participants.length) * 100)
      : 0
  }

  // Timer effect
  useEffect(() => {
    if (timeLimit > 0 && timeRemaining > 0 && !showResults && questions.length > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Auto-advance to next question when time runs out
            if (currentQ < questions.length - 1) {
              setCurrentQ(currentQ + 1)
              return timeLimit
            } else {
              // Auto-submit if on last question
              handleSubmit()
              return 0
            }
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [timeLimit, timeRemaining, showResults, questions.length, currentQ])

  // Overall timer effect
  useEffect(() => {
    if (overallTimeLimit > 0 && overallTimeRemaining > 0 && !showResults && questions.length > 0 && quizStarted) {
      const timer = setInterval(() => {
        setOverallTimeRemaining(prev => {
          if (prev <= 1) {
            // Auto-submit when overall time runs out
            handleSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [overallTimeLimit, overallTimeRemaining, showResults, questions.length, quizStarted])

  return (
    <div className="space-y-6">
      {/* Header Section - Full Width */}
      <div className="bg-[#F2CF7E] border-y border-[#e0bd6c] py-6 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 shadow-sm">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <button 
            onClick={() => {
              if (creationMode === 'manual' && manualQuestions.length > 0) {
                // Reset manual creation
                setManualQuestions([])
                setCurrentManualQ({
                  question: '',
                  options: ['', '', '', ''],
                  correct: 0,
                  explanation: ''
                })
                setCreationMode('ai')
              } else {
                navigate('/ai-tools')
              }
            }} 
            className="w-10 h-10 rounded-lg bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors"
          >
            <i className="ri-arrow-left-line text-xl text-black" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-black">Quiz Generator</h1>
            <p className="text-sm text-black/80 mt-1">
              {mode === 'host' ? 'Host & manage quizzes' : mode === 'participant' ? 'Join & take quizzes' : 'Create custom practice tests'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-black/10 flex items-center justify-center">
            <i className="ri-question-answer-line text-xl text-black" />
          </div>
        </div>
      </div>

      {/* Main Content - Centered */}
      <div className="max-w-4xl mx-auto">
        {/* Mode Selection */}
        {mode === 'select' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button
              onClick={() => setMode('solo')}
              className="bg-white rounded-xl border-2 border-gray-200 hover:border-[#F2CF7E] p-8 text-center transition-all hover:shadow-lg group"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F2CF7E]/10 flex items-center justify-center group-hover:bg-[#F2CF7E]/20 transition-colors">
                <i className="ri-user-line text-3xl text-black" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Solo Practice</h3>
              <p className="text-sm text-gray-600">Practice alone at your own pace</p>
            </button>

            <button
              onClick={() => setMode('host')}
              className="bg-white rounded-xl border-2 border-gray-200 hover:border-[#F2CF7E] p-8 text-center transition-all hover:shadow-lg group"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F2CF7E]/10 flex items-center justify-center group-hover:bg-[#F2CF7E]/20 transition-colors">
                <i className="ri-shield-star-line text-3xl text-black" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Host Quiz</h3>
              <p className="text-sm text-gray-600">Create & manage quiz for others</p>
            </button>

            <button
              onClick={() => setMode('participant')}
              className="bg-white rounded-xl border-2 border-gray-200 hover:border-[#F2CF7E] p-8 text-center transition-all hover:shadow-lg group"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#F2CF7E]/10 flex items-center justify-center group-hover:bg-[#F2CF7E]/20 transition-colors">
                <i className="ri-team-line text-3xl text-black" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Join Quiz</h3>
              <p className="text-sm text-gray-600">Enter code to join a quiz</p>
            </button>
          </div>
        )}

        {/* Creation Mode Selection (Solo & Host) - Redesigned */}
        {(mode === 'solo' || mode === 'host') && questions.length === 0 && manualQuestions.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 space-y-8">
              {/* Creation Method */}
              <div className="space-y-4">
                <div className="pb-3 border-b-2 border-[#F2CF7E]">
                  <h2 className="text-lg font-bold text-gray-900">Creation Method</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setCreationMode('ai')}
                    className={`p-5 rounded-lg border-2 transition-all text-left ${
                      creationMode === 'ai' 
                        ? 'border-[#F2CF7E] bg-[#F2CF7E]/10' 
                        : 'border-gray-200 hover:border-[#F2CF7E]/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        creationMode === 'ai' ? 'bg-[#F2CF7E]' : 'bg-gray-100'
                      }`}>
                        <i className="ri-sparkling-line text-xl text-black" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 mb-1">Generate with AI</h3>
                        <p className="text-xs text-gray-600">AI creates questions from topic or PDF</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setCreationMode('manual')}
                    className={`p-5 rounded-lg border-2 transition-all text-left ${
                      creationMode === 'manual' 
                        ? 'border-[#F2CF7E] bg-[#F2CF7E]/10' 
                        : 'border-gray-200 hover:border-[#F2CF7E]/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        creationMode === 'manual' ? 'bg-[#F2CF7E]' : 'bg-gray-100'
                      }`}>
                        <i className="ri-edit-line text-xl text-black" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-gray-900 mb-1">Manual Creation</h3>
                        <p className="text-xs text-gray-600">Create your own custom questions</p>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* AI Generation Options */}
              {creationMode === 'ai' && (
                <div className="space-y-6">
                  <div className="pb-3 border-b-2 border-[#F2CF7E]">
                    <h2 className="text-lg font-bold text-gray-900">Quiz Configuration</h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Topic <span className="text-[#F2CF7E]">*</span>
                      </label>
                      <input
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        placeholder="e.g., World War II, Calculus, Python Programming"
                        className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Upload PDF <span className="text-gray-500 font-normal">(optional)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".pdf"
                          id="pdf-upload"
                          onChange={e => setFile(e.target.files[0])}
                          className="hidden"
                        />
                        <label
                          htmlFor="pdf-upload"
                          className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 flex items-center justify-between cursor-pointer hover:border-[#F2CF7E] transition-colors"
                        >
                          <span className={file ? 'text-gray-900' : 'text-gray-400'}>
                            {file ? file.name : 'Choose PDF file...'}
                          </span>
                          <span className="px-4 py-2 rounded-lg bg-[#F2CF7E] text-black text-sm font-semibold hover:bg-[#e0bd6c] transition-colors">
                            Browse
                          </span>
                        </label>
                      </div>
                      {file && (
                        <p className="text-xs text-gray-600 mt-2 flex items-center">
                          <i className="ri-file-pdf-line mr-1" />
                          {file.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Number of Questions
                      </label>
                      <input
                        type="number"
                        value={numQuestions}
                        onChange={e => setNumQuestions(parseInt(e.target.value))}
                        min="5"
                        max="20"
                        className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        Difficulty Level
                      </label>
                      <select
                        value={difficulty}
                        onChange={e => setDifficulty(e.target.value)}
                        className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                      >
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>

                    {mode === 'host' && (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Time Limit Per Question <span className="text-gray-500 font-normal">(optional)</span>
                          </label>
                          <select
                            value={timeLimit}
                            onChange={e => {
                              setTimeLimit(parseInt(e.target.value))
                              if (parseInt(e.target.value) > 0) setOverallTimeLimit(0)
                            }}
                            disabled={overallTimeLimit > 0}
                            className={`w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors ${
                              overallTimeLimit > 0 ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''
                            }`}
                          >
                            <option value="0">No Time Limit</option>
                            <option value="30">30 seconds</option>
                            <option value="60">1 minute</option>
                            <option value="90">1.5 minutes</option>
                            <option value="120">2 minutes</option>
                            <option value="180">3 minutes</option>
                          </select>
                          {overallTimeLimit > 0 && (
                            <p className="text-xs text-gray-500 mt-1">Disabled (Overall quiz time limit is set)</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-900 mb-2">
                            Overall Quiz Time Limit <span className="text-gray-500 font-normal">(optional)</span>
                          </label>
                          <select
                            value={overallTimeLimit}
                            onChange={e => {
                              setOverallTimeLimit(parseInt(e.target.value))
                              if (parseInt(e.target.value) > 0) setTimeLimit(0)
                            }}
                            disabled={timeLimit > 0}
                            className={`w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors ${
                              timeLimit > 0 ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''
                            }`}
                          >
                            <option value="0">No Time Limit</option>
                            <option value="5">5 minutes</option>
                            <option value="10">10 minutes</option>
                            <option value="15">15 minutes</option>
                            <option value="20">20 minutes</option>
                            <option value="30">30 minutes</option>
                            <option value="45">45 minutes</option>
                            <option value="60">1 hour</option>
                          </select>
                          {timeLimit > 0 && (
                            <p className="text-xs text-gray-500 mt-1">Disabled (Per question time limit is set)</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Manual Creation Notice */}
              {creationMode === 'manual' && (
                <div className="space-y-6">
                  <div className="pb-3 border-b-2 border-[#F2CF7E]">
                    <h2 className="text-lg font-bold text-gray-900">Create Questions Manually</h2>
                  </div>
                  
                  {mode === 'host' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Time Limit Per Question <span className="text-gray-500 font-normal">(optional)</span>
                        </label>
                        <select
                          value={timeLimit}
                          onChange={e => {
                            setTimeLimit(parseInt(e.target.value))
                            if (parseInt(e.target.value) > 0) setOverallTimeLimit(0)
                          }}
                          disabled={overallTimeLimit > 0}
                          className={`w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors ${
                            overallTimeLimit > 0 ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''
                          }`}
                        >
                          <option value="0">No Time Limit</option>
                          <option value="30">30 seconds</option>
                          <option value="60">1 minute</option>
                          <option value="90">1.5 minutes</option>
                          <option value="120">2 minutes</option>
                          <option value="180">3 minutes</option>
                        </select>
                        {overallTimeLimit > 0 && (
                          <p className="text-xs text-gray-500 mt-1">Disabled (Overall quiz time limit is set)</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                          Overall Quiz Time Limit <span className="text-gray-500 font-normal">(optional)</span>
                        </label>
                        <select
                          value={overallTimeLimit}
                          onChange={e => {
                            setOverallTimeLimit(parseInt(e.target.value))
                            if (parseInt(e.target.value) > 0) setTimeLimit(0)
                          }}
                          disabled={timeLimit > 0}
                          className={`w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors ${
                            timeLimit > 0 ? 'opacity-50 cursor-not-allowed bg-gray-100' : ''
                          }`}
                        >
                          <option value="0">No Time Limit</option>
                          <option value="5">5 minutes</option>
                          <option value="10">10 minutes</option>
                          <option value="15">15 minutes</option>
                          <option value="20">20 minutes</option>
                          <option value="30">30 minutes</option>
                          <option value="45">45 minutes</option>
                          <option value="60">1 hour</option>
                        </select>
                        {timeLimit > 0 && (
                          <p className="text-xs text-gray-500 mt-1">Disabled (Per question time limit is set)</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="bg-[#F2CF7E]/10 border-2 border-[#F2CF7E] rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <i className="ri-information-line text-xl text-black flex-shrink-0 mt-0.5" />
                      <div>
                        <h3 className="font-bold text-gray-900 mb-1">Ready to Create Questions</h3>
                        <p className="text-sm text-gray-700">Start adding your custom questions below. You can add as many as you need.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            {creationMode === 'ai' && (
              <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E] flex justify-end">
                <button
                  onClick={handleGenerate}
                  disabled={loading || (!topic && !file)}
                  className="px-8 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin text-lg" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <i className="ri-sparkling-line text-lg" />
                      Generate Quiz
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Participant Join Screen */}
        {mode === 'participant' && !isJoined && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="text-center mb-6">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#F2CF7E]/10 flex items-center justify-center">
                  <i className="ri-login-box-line text-4xl text-black" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Join a Quiz</h2>
                <p className="text-gray-600">Enter the quiz code provided by your host</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Your Name <span className="text-[#F2CF7E]">*</span>
                </label>
                <input
                  value={participantName}
                  onChange={e => setParticipantName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Quiz Code <span className="text-[#F2CF7E]">*</span>
                </label>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors uppercase tracking-widest text-center text-2xl font-bold"
                />
                {joinError && (
                  <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                    <i className="ri-error-warning-line" />{joinError}
                  </p>
                )}
              </div>
            </div>

            <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E] flex gap-3">
              <button
                onClick={() => setMode('select')}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-white hover:border-gray-400 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleJoinQuiz}
                disabled={joinLoading || !participantName.trim() || joinCode.length !== 6}
                className="flex-1 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joinLoading ? (
                  <><i className="ri-loader-4-line animate-spin mr-2" />Joining...</>
                ) : (
                  <><i className="ri-login-circle-line mr-2" />Join Quiz</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Manual Question Creation Form */}
        {(mode === 'solo' || mode === 'host') && creationMode === 'manual' && questions.length === 0 && manualQuestions.length >= 0 && (
          <div className="space-y-6">
            {/* Current Question Builder */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 sm:p-8 space-y-6">
                <div className="pb-3 border-b-2 border-[#F2CF7E] flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">
                    <i className="ri-add-circle-line mr-2" />
                    Create Question #{manualQuestions.length + 1}
                  </h2>
                  <button
                    onClick={() => setCreationMode('ai')}
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center"
                  >
                    <i className="ri-arrow-left-line mr-1" />
                    Switch to AI
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Question <span className="text-[#F2CF7E]">*</span>
                  </label>
                  <textarea
                    value={currentManualQ.question}
                    onChange={e => setCurrentManualQ({ ...currentManualQ, question: e.target.value })}
                    placeholder="Enter your question here..."
                    rows="3"
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors resize-none"
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-gray-900 mb-3">
                    Answer Options <span className="text-[#F2CF7E]">*</span>
                    <span className="text-xs text-gray-500 font-normal ml-2">(Click circle to mark correct answer)</span>
                  </label>
                  {currentManualQ.options.map((opt, i) => (
                    <div key={i} className="flex gap-3 items-center">
                      <button
                        type="button"
                        onClick={() => setCurrentManualQ({ ...currentManualQ, correct: i })}
                        className={`w-10 h-10 flex-shrink-0 rounded-lg border-2 flex items-center justify-center transition-all ${
                          currentManualQ.correct === i
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}
                        title="Mark as correct answer"
                      >
                        {currentManualQ.correct === i ? <i className="ri-checkbox-circle-fill text-xl" /> : <i className="ri-checkbox-blank-circle-line text-xl" />}
                      </button>
                      <input
                        value={opt}
                        onChange={e => {
                          const newOptions = [...currentManualQ.options]
                          newOptions[i] = e.target.value
                          setCurrentManualQ({ ...currentManualQ, options: newOptions })
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Explanation <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={currentManualQ.explanation}
                    onChange={e => setCurrentManualQ({ ...currentManualQ, explanation: e.target.value })}
                    placeholder="Explain why this is the correct answer..."
                    rows="2"
                    className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors resize-none"
                  />
                </div>

                {mode === 'host' && manualQuestions.length === 0 && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Time Limit Per Question <span className="text-gray-500 font-normal">(optional)</span>
                    </label>
                    <select
                      value={timeLimit}
                      onChange={e => setTimeLimit(parseInt(e.target.value))}
                      className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                    >
                      <option value="0">No Time Limit</option>
                      <option value="30">30 seconds</option>
                      <option value="60">1 minute</option>
                      <option value="90">1.5 minutes</option>
                      <option value="120">2 minutes</option>
                      <option value="180">3 minutes</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E] flex gap-3">
                <button
                  type="button"
                  onClick={addManualQuestion}
                  disabled={!currentManualQ.question.trim() || currentManualQ.options.some(opt => !opt.trim())}
                  className="flex-1 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="ri-add-line mr-2" />
                  Add Question
                </button>
              </div>
            </div>

            {/* Added Questions List */}
            {manualQuestions.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-6 sm:p-8">
                  <div className="pb-3 border-b-2 border-[#F2CF7E] mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-gray-900">
                      <i className="ri-list-check mr-2" />
                      Added Questions ({manualQuestions.length})
                    </h3>
                  </div>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {manualQuestions.map((q, i) => (
                      <div key={i} className="p-4 rounded-lg border-2 border-gray-200 hover:border-[#F2CF7E]/50 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <p className="font-semibold text-gray-900 flex-1 pr-3">
                            <span className="text-[#F2CF7E] mr-2">Q{i + 1}.</span>
                            {q.question}
                          </p>
                          <button
                            onClick={() => removeManualQuestion(i)}
                            className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 flex items-center justify-center transition-colors"
                            title="Delete question"
                          >
                            <i className="ri-delete-bin-line text-lg" />
                          </button>
                        </div>
                        <div className="space-y-2 text-sm">
                          {q.options.map((opt, j) => (
                            <div key={j} className={`p-2 rounded flex items-center gap-2 ${j === q.correct ? 'bg-green-50 text-green-800 font-medium border border-green-200' : 'text-gray-600 bg-gray-50'}`}>
                              {j === q.correct && <i className="ri-checkbox-circle-fill text-green-600" />}
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                        {q.explanation && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-600">
                              <i className="ri-information-line mr-1" />
                              {q.explanation}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E] flex justify-end">
                  <button
                    onClick={finalizeManualQuiz}
                    className="px-8 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-colors shadow-md"
                  >
                    <i className="ri-check-line mr-2" />
                    Start Quiz ({manualQuestions.length} question{manualQuestions.length !== 1 ? 's' : ''})
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Host Dashboard - Waiting / Managing */}
        {mode === 'host' && questions.length > 0 && (
          <div className="space-y-4">
            {/* Quiz Code Banner */}
            <div className="bg-gradient-to-br from-[#F2CF7E] to-[#e0bd6c] rounded-xl p-6 shadow-lg">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm font-semibold text-black/70 mb-1">Quiz Code — share with participants</p>
                  <div className="text-5xl font-bold text-black tracking-widest">{quizCode}</div>
                </div>
                <div className="flex flex-col gap-2 text-sm text-black/80">
                  <span><i className="ri-question-line mr-1" />{questions.length} questions</span>
                  {timeLimit > 0 && <span><i className="ri-time-line mr-1" />{timeLimit}s per question</span>}
                  {overallTimeLimit > 0 && <span><i className="ri-timer-line mr-1" />{overallTimeLimit} min total</span>}
                  <span><i className="ri-group-line mr-1" />{participants.length} submitted</span>
                </div>
              </div>
              {!quizStarted && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => setQuestions([])}
                    className="px-5 py-2 bg-black/10 hover:bg-black/20 text-black font-semibold rounded-lg text-sm transition-colors"
                  >
                    <i className="ri-close-line mr-1" />Cancel
                  </button>
                  <button
                    onClick={handleHostStartManaging}
                    className="flex-1 py-2 bg-black text-[#F2CF7E] font-bold rounded-lg hover:bg-black/80 transition-colors text-sm"
                  >
                    <i className="ri-dashboard-line mr-2" />Open Management Dashboard
                  </button>
                </div>
              )}
            </div>

            {/* Management Dashboard */}
            {quizStarted && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b-2 border-gray-100">
                  {[
                    { id: 'leaderboard', label: 'Leaderboard', icon: 'ri-trophy-line' },
                    { id: 'questions', label: 'Questions', icon: 'ri-list-check' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
                        activeTab === tab.id
                          ? 'border-b-2 border-[#F2CF7E] text-black bg-[#F2CF7E]/5'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <i className={tab.icon} />{tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-6">
                  {/* Leaderboard Tab */}
                  {activeTab === 'leaderboard' && (
                    <div className="space-y-4">
                      {/* Stats row */}
                      {participants.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          {[
                            { label: 'Submitted', value: participants.length },
                            { label: 'Avg Score', value: (participants.reduce((s,p)=>s+p.score,0)/participants.length).toFixed(1) },
                            { label: 'Highest', value: Math.max(...participants.map(p=>p.score)) },
                            { label: 'Pass Rate', value: Math.round(participants.filter(p=>p.percentage>=60).length/participants.length*100)+'%' },
                          ].map(stat => (
                            <div key={stat.label} className="text-center p-3 bg-[#F2CF7E]/10 rounded-lg border border-[#F2CF7E]/30">
                              <div className="text-xl font-bold text-black">{stat.value}</div>
                              <div className="text-xs text-gray-600 mt-0.5">{stat.label}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {participants.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                          <i className="ri-hourglass-line text-5xl mb-3 block" />
                          <p className="font-medium">Waiting for participants to submit...</p>
                          <p className="text-sm mt-1">Live updates every 4 seconds</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {[...participants].sort((a,b)=>b.percentage-a.percentage).map((p, idx) => (
                            <div key={p.name} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#F2CF7E]/50 transition-colors">
                              {/* Rank badge */}
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                                idx === 1 ? 'bg-gray-300 text-gray-700' :
                                idx === 2 ? 'bg-orange-300 text-orange-900' :
                                'bg-gray-100 text-gray-600'
                              }`}>{idx + 1}</div>

                              {/* Name + time */}
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                                <div className="text-xs text-gray-400">{new Date(p.completedAt).toLocaleTimeString()}</div>
                              </div>

                              {/* Score display or edit */}
                              {editingScore === p.name ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={editScoreValue}
                                    onChange={e => setEditScoreValue(e.target.value)}
                                    min="0"
                                    max={p.total}
                                    className="w-16 h-8 px-2 text-center border-2 border-[#F2CF7E] rounded-lg text-sm font-bold focus:outline-none"
                                    autoFocus
                                    onKeyDown={e => { if (e.key === 'Enter') handleEditScore(p.name); if (e.key === 'Escape') setEditingScore(null) }}
                                  />
                                  <span className="text-xs text-gray-500">/{p.total}</span>
                                  <button onClick={() => handleEditScore(p.name)} className="w-7 h-7 bg-green-500 text-white rounded-lg flex items-center justify-center hover:bg-green-600">
                                    <i className="ri-check-line text-sm" />
                                  </button>
                                  <button onClick={() => setEditingScore(null)} className="w-7 h-7 bg-gray-200 text-gray-600 rounded-lg flex items-center justify-center hover:bg-gray-300">
                                    <i className="ri-close-line text-sm" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <div className="font-bold text-black">{p.score}/{p.total}</div>
                                    <div className={`text-xs font-semibold ${p.percentage>=80?'text-green-600':p.percentage>=60?'text-yellow-600':'text-red-600'}`}>{p.percentage}%</div>
                                  </div>
                                  <button
                                    onClick={() => { setEditingScore(p.name); setEditScoreValue(String(p.score)) }}
                                    className="w-7 h-7 bg-[#F2CF7E]/20 text-black rounded-lg flex items-center justify-center hover:bg-[#F2CF7E]/50 transition-colors"
                                    title="Edit score"
                                  >
                                    <i className="ri-edit-line text-sm" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveResponse(p.name)}
                                    className="w-7 h-7 bg-red-50 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors"
                                    title="Remove response"
                                  >
                                    <i className="ri-delete-bin-line text-sm" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Questions Tab */}
                  {activeTab === 'questions' && (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                      {questions.map((q, i) => (
                        <div key={i} className="p-4 rounded-lg border-2 border-gray-200">
                          <p className="font-semibold text-gray-900 mb-3">
                            <span className="text-[#F2CF7E] mr-2">Q{i+1}.</span>
                            {renderQuestion(q.question)}
                          </p>
                          <div className="space-y-1.5">
                            {q.options.map((opt, j) => (
                              <div key={j} className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                                j === q.correct ? 'bg-green-50 border border-green-200 text-green-800 font-medium' : 'bg-gray-50 text-gray-600'
                              }`}>
                                {j === q.correct && <i className="ri-checkbox-circle-fill text-green-600 flex-shrink-0" />}
                                {opt}
                              </div>
                            ))}
                          </div>
                          {q.explanation && (
                            <p className="mt-2 text-xs text-gray-500 flex items-start gap-1">
                              <i className="ri-information-line flex-shrink-0 mt-0.5" />{q.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <i className="ri-refresh-line" />Live updates every 4s
                  </span>
                  <button
                    onClick={() => {
                      setHostPolling(false)
                      setQuestions([])
                      setMode('select')
                      setQuizCode('')
                      setQuizStarted(false)
                      setParticipants([])
                    }}
                    className="px-4 py-2 bg-red-50 text-red-600 font-semibold rounded-lg text-sm hover:bg-red-100 transition-colors"
                  >
                    <i className="ri-stop-circle-line mr-1" />End Quiz
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quiz Taking Interface — Solo and Participant only */}
        {((mode === 'solo' || (mode === 'participant' && isJoined)) && questions.length > 0 && !showResults) && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-900">Question {currentQ + 1} of {questions.length}</h2>
                <div className="flex items-center gap-3">
                  {overallTimeLimit > 0 && (
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
                      overallTimeRemaining <= 60 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      <i className="ri-timer-line text-lg" />
                      <span className="font-bold text-sm">
                        Total: {Math.floor(overallTimeRemaining / 60)}:{(overallTimeRemaining % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}
                  {timeLimit > 0 && (
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
                      timeRemaining <= 10 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      <i className="ri-time-line text-lg" />
                      <span className="font-bold">{timeRemaining}s</span>
                    </div>
                  )}
                  <div className="text-sm text-gray-500 font-medium">{Object.keys(answers).length}/{questions.length} answered</div>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-lg font-semibold mb-4 text-gray-900">{renderQuestion(questions[currentQ]?.question)}</p>
                <div className="space-y-3">
                  {questions[currentQ]?.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => handleAnswer(currentQ, i)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        answers[currentQ] === i
                          ? 'border-[#F2CF7E] bg-[#F2CF7E]/10'
                          : 'border-gray-200 hover:border-[#F2CF7E]/50'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E] flex gap-3">
              <button
                onClick={() => {
                  setCurrentQ(Math.max(0, currentQ - 1))
                  if (timeLimit > 0) setTimeRemaining(timeLimit)
                }}
                disabled={currentQ === 0}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-white hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-arrow-left-line mr-2" />
                Previous
              </button>
              {currentQ < questions.length - 1 ? (
                <button
                  onClick={handleNextQuestion}
                  className="flex-1 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-colors shadow-md"
                >
                  Next
                  <i className="ri-arrow-right-line ml-2" />
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-colors shadow-md"
                >
                  <i className="ri-check-line mr-2" />
                  Submit Quiz
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results Screen — Solo and Participant only */}
        {showResults && mode !== 'host' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-center mb-4">Quiz Results</h2>
                <div className="text-center mb-6">
                  <div className="text-5xl font-bold text-black">{score}/{questions.length}</div>
                  <p className="text-gray-600 mt-2">You got {Math.round((score/questions.length)*100)}% correct!</p>
                  {mode === 'participant' && (
                    <p className="text-sm text-gray-500 mt-2">Your result has been submitted to the host</p>
                  )}
                </div>

                {/* Host Statistics */}
                {mode === 'host' && participants.length > 0 && (
                  <div className="mb-6 p-6 bg-gradient-to-br from-[#F2CF7E]/10 to-[#F2CF7E]/5 rounded-lg border-2 border-[#F2CF7E]">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                      <i className="ri-bar-chart-box-line mr-2" />
                      Quiz Statistics
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-black">{quizStats.totalParticipants}</div>
                        <div className="text-xs text-gray-600 mt-1">Participants</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-black">{quizStats.averageScore}</div>
                        <div className="text-xs text-gray-600 mt-1">Avg Score</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-black">{quizStats.highestScore}</div>
                        <div className="text-xs text-gray-600 mt-1">Highest</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-black">{quizStats.lowestScore}</div>
                        <div className="text-xs text-gray-600 mt-1">Lowest</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-black">{quizStats.passRate}%</div>
                        <div className="text-xs text-gray-600 mt-1">Pass Rate</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Host Leaderboard - Now visible to all users */}
                {(mode === 'host' || mode === 'participant') && (
                  <div className="mb-6">
                    <button
                      onClick={() => setShowLeaderboard(!showLeaderboard)}
                      className="w-full py-3 px-4 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-colors flex items-center justify-center gap-2 mb-4"
                    >
                      <i className="ri-trophy-line text-lg" />
                      {showLeaderboard ? 'Hide' : 'Show'} Leaderboard ({participants.length} participants)
                      <i className={`ri-arrow-${showLeaderboard ? 'up' : 'down'}-s-line text-lg`} />
                    </button>

                    {showLeaderboard && participants.length > 0 && (
                      <div className="border-2 border-[#F2CF7E] rounded-lg overflow-hidden">
                        <div className="bg-[#F2CF7E] px-4 py-3">
                          <h3 className="font-bold text-black flex items-center">
                            <i className="ri-trophy-line mr-2" />
                            Leaderboard
                          </h3>
                        </div>
                        <div className="divide-y divide-gray-200">
                          {sortedParticipants.map((participant, index) => (
                            <div key={index} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                  index === 0 ? 'bg-yellow-400 text-yellow-900' :
                                  index === 1 ? 'bg-gray-300 text-gray-700' :
                                  index === 2 ? 'bg-orange-300 text-orange-900' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {index + 1}
                                </div>
                                <div>
                                  <div className="font-semibold text-gray-900">
                                    {participant.name}
                                    {mode === 'participant' && participant.name === participantName && (
                                      <span className="ml-2 text-xs bg-[#F2CF7E] text-black px-2 py-1 rounded">You</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {new Date(participant.completedAt).toLocaleTimeString()}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-black">{participant.score}/{participant.total}</div>
                                <div className={`text-xs font-semibold ${
                                  participant.percentage >= 80 ? 'text-green-600' :
                                  participant.percentage >= 60 ? 'text-yellow-600' :
                                  'text-red-600'
                                }`}>
                                  {participant.percentage}%
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {showLeaderboard && participants.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <i className="ri-user-line text-4xl mb-2" />
                        <p>No participants have completed the quiz yet</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Question Review */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-gray-900 pb-3 border-b-2 border-[#F2CF7E]">Answer Review</h3>
                  {questions.map((q, i) => (
                    <div key={i} className="p-4 rounded-lg border-2 border-gray-200">
                      <p className="font-semibold mb-2">{i+1}. {renderQuestion(q.question)}</p>
                      {q.options.map((opt, j) => (
                        <div key={j} className={`p-2 rounded mb-1 ${
                          j === q.correct ? 'bg-green-100 text-green-800 border-2 border-green-300' :
                          answers[i] === j ? 'bg-red-100 text-red-800 border-2 border-red-300' : 'bg-gray-50'
                        }`}>
                          {opt} {j === q.correct && '✓'}
                        </div>
                      ))}
                      <p className="text-sm text-gray-600 mt-2">{q.explanation}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E] flex gap-3">
                <button 
                  onClick={() => {
                    setLeaderboardPolling(false)
                    setQuestions([])
                    setMode('select')
                    setQuizCode('')
                    setQuizStarted(false)
                    setParticipants([])
                    setShowLeaderboard(false)
                    setIsJoined(false)
                  }} 
                  className="flex-1 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-colors shadow-md"
                >
                  <i className="ri-refresh-line mr-2" />
                  Create New Quiz
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
