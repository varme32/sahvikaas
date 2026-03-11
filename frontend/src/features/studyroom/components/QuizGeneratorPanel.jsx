import { useState, useEffect } from 'react'
import { apiRequest } from '../../../lib/api'

export default function QuizGeneratorPanel() {
  const [mode, setMode] = useState('select') // 'select', 'solo', 'host'
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
  const [timeLimit, setTimeLimit] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [overallTimeLimit, setOverallTimeLimit] = useState(0)
  const [overallTimeRemaining, setOverallTimeRemaining] = useState(0)
  
  // Manual question creation
  const [manualQuestions, setManualQuestions] = useState([])
  const [currentManualQ, setCurrentManualQ] = useState({
    question: '',
    options: ['', '', '', ''],
    correct: 0,
    explanation: ''
  })

  const generateQuizCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
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
      setQuestions(res.questions || [])
      
      if (mode === 'host') {
        const code = generateQuizCode()
        setQuizCode(code)
        setQuizStarted(false)
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

  const finalizeManualQuiz = () => {
    if (manualQuestions.length === 0) {
      alert('Please add at least one question')
      return
    }
    setQuestions(manualQuestions)
    if (mode === 'host') {
      const code = generateQuizCode()
      setQuizCode(code)
      setQuizStarted(false)
    } else {
      setCurrentQ(0)
      setAnswers({})
      setShowResults(false)
    }
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
      setOverallTimeRemaining(overallTimeLimit * 60)
    }
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

  const handleSubmit = () => {
    const finalScore = Object.entries(answers).filter(([qIdx, ans]) => 
      questions[qIdx]?.correct === ans
    ).length
    
    // Add to participants for leaderboard (simulated for study room)
    if (mode === 'host') {
      const newParticipant = {
        name: 'Host',
        score: finalScore,
        total: questions.length,
        percentage: Math.round((finalScore / questions.length) * 100),
        completedAt: new Date().toISOString()
      }
      setParticipants([...participants, newParticipant])
    }
    
    setShowResults(true)
  }

  const score = Object.entries(answers).filter(([qIdx, ans]) => 
    questions[qIdx]?.correct === ans
  ).length

  const sortedParticipants = [...participants].sort((a, b) => b.score - a.score)

  // Timer effects
  useEffect(() => {
    if (timeLimit > 0 && timeRemaining > 0 && !showResults && questions.length > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            if (currentQ < questions.length - 1) {
              setCurrentQ(currentQ + 1)
              return timeLimit
            } else {
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

  useEffect(() => {
    if (overallTimeLimit > 0 && overallTimeRemaining > 0 && !showResults && questions.length > 0 && quizStarted) {
      const timer = setInterval(() => {
        setOverallTimeRemaining(prev => {
          if (prev <= 1) {
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
    <div className="flex flex-col h-full bg-white">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Mode Selection */}
        {mode === 'select' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-900">Choose Quiz Mode</h3>
            <button
              onClick={() => setMode('solo')}
              className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-[#F2CF7E] text-left transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#F2CF7E]/10 flex items-center justify-center">
                  <i className="ri-user-line text-xl text-black" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Solo Practice</h4>
                  <p className="text-xs text-gray-600">Practice at your own pace</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setMode('host')}
              className="w-full p-4 rounded-lg border-2 border-gray-200 hover:border-[#F2CF7E] text-left transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#F2CF7E]/10 flex items-center justify-center">
                  <i className="ri-shield-star-line text-xl text-black" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Host Quiz</h4>
                  <p className="text-xs text-gray-600">Create quiz for study group</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Creation Mode & Configuration */}
        {(mode === 'solo' || mode === 'host') && questions.length === 0 && manualQuestions.length === 0 && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('select')}
              className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <i className="ri-arrow-left-line" />
              Back
            </button>

            {/* Creation Method */}
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Creation Method</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCreationMode('ai')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    creationMode === 'ai' ? 'border-[#F2CF7E] bg-[#F2CF7E]/10' : 'border-gray-200'
                  }`}
                >
                  <i className="ri-sparkling-line text-lg text-black mb-1" />
                  <p className="text-xs font-bold text-gray-900">AI Generate</p>
                </button>

                <button
                  onClick={() => setCreationMode('manual')}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    creationMode === 'manual' ? 'border-[#F2CF7E] bg-[#F2CF7E]/10' : 'border-gray-200'
                  }`}
                >
                  <i className="ri-edit-line text-lg text-black mb-1" />
                  <p className="text-xs font-bold text-gray-900">Manual</p>
                </button>
              </div>
            </div>

            {/* AI Configuration */}
            {creationMode === 'ai' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">
                    Topic <span className="text-[#F2CF7E]">*</span>
                  </label>
                  <input
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    placeholder="e.g., Python Programming"
                    className="w-full h-10 px-3 rounded-lg border-2 border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">
                    Upload PDF <span className="text-gray-500 font-normal">(optional)</span>
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    id="pdf-upload-panel"
                    onChange={e => setFile(e.target.files[0])}
                    className="hidden"
                  />
                  <label
                    htmlFor="pdf-upload-panel"
                    className="w-full h-10 px-3 rounded-lg border-2 border-gray-200 text-sm flex items-center justify-between cursor-pointer hover:border-[#F2CF7E]"
                  >
                    <span className={file ? 'text-gray-900' : 'text-gray-400'}>
                      {file ? file.name : 'Choose PDF...'}
                    </span>
                    <span className="px-3 py-1 rounded bg-[#F2CF7E] text-black text-xs font-semibold">
                      Browse
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1">Questions</label>
                    <input
                      type="number"
                      value={numQuestions}
                      onChange={e => setNumQuestions(parseInt(e.target.value))}
                      min="5"
                      max="20"
                      className="w-full h-10 px-3 rounded-lg border-2 border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-1">Difficulty</label>
                    <select
                      value={difficulty}
                      onChange={e => setDifficulty(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border-2 border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E]"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                {mode === 'host' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-900 mb-1">Per Question</label>
                      <select
                        value={timeLimit}
                        onChange={e => {
                          setTimeLimit(parseInt(e.target.value))
                          if (parseInt(e.target.value) > 0) setOverallTimeLimit(0)
                        }}
                        disabled={overallTimeLimit > 0}
                        className={`w-full h-10 px-3 rounded-lg border-2 border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E] ${
                          overallTimeLimit > 0 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <option value="0">No Limit</option>
                        <option value="30">30s</option>
                        <option value="60">1min</option>
                        <option value="120">2min</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-900 mb-1">Overall</label>
                      <select
                        value={overallTimeLimit}
                        onChange={e => {
                          setOverallTimeLimit(parseInt(e.target.value))
                          if (parseInt(e.target.value) > 0) setTimeLimit(0)
                        }}
                        disabled={timeLimit > 0}
                        className={`w-full h-10 px-3 rounded-lg border-2 border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E] ${
                          timeLimit > 0 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <option value="0">No Limit</option>
                        <option value="5">5min</option>
                        <option value="10">10min</option>
                        <option value="15">15min</option>
                        <option value="30">30min</option>
                      </select>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={loading || (!topic && !file)}
                  className="w-full py-2.5 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] disabled:opacity-50 text-sm"
                >
                  {loading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <i className="ri-sparkling-line mr-2" />
                      Generate Quiz
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Manual Creation */}
            {creationMode === 'manual' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-600 bg-[#F2CF7E]/10 p-3 rounded-lg border border-[#F2CF7E]">
                  <i className="ri-information-line mr-1" />
                  Create custom questions for your study group
                </p>

                {mode === 'host' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-900 mb-1">Per Question</label>
                      <select
                        value={timeLimit}
                        onChange={e => {
                          setTimeLimit(parseInt(e.target.value))
                          if (parseInt(e.target.value) > 0) setOverallTimeLimit(0)
                        }}
                        disabled={overallTimeLimit > 0}
                        className={`w-full h-10 px-3 rounded-lg border-2 border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E] ${
                          overallTimeLimit > 0 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <option value="0">No Limit</option>
                        <option value="30">30s</option>
                        <option value="60">1min</option>
                        <option value="120">2min</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-900 mb-1">Overall</label>
                      <select
                        value={overallTimeLimit}
                        onChange={e => {
                          setOverallTimeLimit(parseInt(e.target.value))
                          if (parseInt(e.target.value) > 0) setTimeLimit(0)
                        }}
                        disabled={timeLimit > 0}
                        className={`w-full h-10 px-3 rounded-lg border-2 border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E] ${
                          timeLimit > 0 ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        <option value="0">No Limit</option>
                        <option value="5">5min</option>
                        <option value="10">10min</option>
                        <option value="15">15min</option>
                        <option value="30">30min</option>
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Question</label>
                  <textarea
                    value={currentManualQ.question}
                    onChange={e => setCurrentManualQ({ ...currentManualQ, question: e.target.value })}
                    placeholder="Enter question..."
                    rows="2"
                    className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E] resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-gray-900">Options (click circle for correct)</label>
                  {currentManualQ.options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentManualQ({ ...currentManualQ, correct: i })}
                        className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center ${
                          currentManualQ.correct === i ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200'
                        }`}
                      >
                        {currentManualQ.correct === i ? <i className="ri-checkbox-circle-fill" /> : <i className="ri-checkbox-blank-circle-line" />}
                      </button>
                      <input
                        value={opt}
                        onChange={e => {
                          const newOptions = [...currentManualQ.options]
                          newOptions[i] = e.target.value
                          setCurrentManualQ({ ...currentManualQ, options: newOptions })
                        }}
                        placeholder={`Option ${i + 1}`}
                        className="flex-1 h-8 px-3 rounded-lg border-2 border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E]"
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-1">Explanation (optional)</label>
                  <textarea
                    value={currentManualQ.explanation}
                    onChange={e => setCurrentManualQ({ ...currentManualQ, explanation: e.target.value })}
                    placeholder="Explain why this is correct..."
                    rows="2"
                    className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E] resize-none"
                  />
                </div>

                <button
                  onClick={addManualQuestion}
                  disabled={!currentManualQ.question.trim() || currentManualQ.options.some(opt => !opt.trim())}
                  className="w-full py-2 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] disabled:opacity-50 text-sm"
                >
                  <i className="ri-add-line mr-1" />
                  Add Question
                </button>

                {manualQuestions.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-900">Added: {manualQuestions.length} questions</p>
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-2 border-2 border-gray-200 rounded-lg p-2">
                      {manualQuestions.map((q, i) => (
                        <div key={i} className="p-2 rounded-lg border border-gray-200 bg-gray-50">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-xs font-semibold text-gray-900 flex-1 pr-2">Q{i + 1}. {q.question.substring(0, 50)}{q.question.length > 50 ? '...' : ''}</p>
                            <button
                              onClick={() => removeManualQuestion(i)}
                              className="flex-shrink-0 w-6 h-6 rounded bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center"
                            >
                              <i className="ri-delete-bin-line text-sm" />
                            </button>
                          </div>
                          <div className="text-xs text-gray-600">
                            {q.options.map((opt, j) => (
                              <div key={j} className={`${j === q.correct ? 'text-green-600 font-semibold' : ''}`}>
                                {j === q.correct && '✓ '}{opt.substring(0, 30)}{opt.length > 30 ? '...' : ''}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={finalizeManualQuiz}
                      className="w-full py-2 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] text-sm"
                    >
                      <i className="ri-check-line mr-1" />
                      Start Quiz ({manualQuestions.length})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Host Dashboard */}
        {mode === 'host' && questions.length > 0 && !quizStarted && (
          <div className="space-y-3">
            <button
              onClick={() => setQuestions([])}
              className="text-xs text-gray-600 hover:text-gray-900 flex items-center gap-1"
            >
              <i className="ri-arrow-left-line" />
              Back
            </button>

            <div className="bg-gradient-to-br from-[#F2CF7E] to-[#e0bd6c] rounded-lg p-4 text-center">
              <p className="text-xs font-bold text-black mb-1">Quiz Code</p>
              <p className="text-3xl font-bold text-black tracking-widest">{quizCode}</p>
              <p className="text-xs text-black/80 mt-1">Share with participants</p>
            </div>

            <div className="bg-white rounded-lg border-2 border-gray-200 p-3">
              <h4 className="text-xs font-bold text-gray-900 mb-2 pb-2 border-b border-[#F2CF7E]">Quiz Info</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center p-2 bg-gray-50 rounded">
                  <p className="text-lg font-bold text-black">{questions.length}</p>
                  <p className="text-xs text-gray-600">Questions</p>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded">
                  <p className="text-lg font-bold text-black capitalize">{difficulty}</p>
                  <p className="text-xs text-gray-600">Difficulty</p>
                </div>
              </div>
              {(timeLimit > 0 || overallTimeLimit > 0) && (
                <div className="mt-2 p-2 bg-[#F2CF7E]/10 rounded border border-[#F2CF7E]">
                  <p className="text-xs font-bold text-gray-900 mb-1 flex items-center">
                    <i className="ri-time-line mr-1" />
                    Time Limit
                  </p>
                  <p className="text-xs text-gray-700">
                    {timeLimit > 0 && `${timeLimit}s per question`}
                    {overallTimeLimit > 0 && `${overallTimeLimit}min total`}
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={handleStartQuiz}
              className="w-full py-2.5 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] text-sm"
            >
              <i className="ri-play-circle-line mr-2" />
              Start Quiz
            </button>
          </div>
        )}

        {/* Quiz Taking */}
        {((mode === 'solo' || (mode === 'host' && quizStarted)) && questions.length > 0 && !showResults) && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-gray-900">Q {currentQ + 1}/{questions.length}</span>
              <div className="flex gap-2">
                {overallTimeLimit > 0 && (
                  <span className={`px-2 py-1 rounded ${overallTimeRemaining <= 60 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {Math.floor(overallTimeRemaining / 60)}:{(overallTimeRemaining % 60).toString().padStart(2, '0')}
                  </span>
                )}
                {timeLimit > 0 && (
                  <span className={`px-2 py-1 rounded ${timeRemaining <= 10 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                    {timeRemaining}s
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-semibold text-gray-900">{questions[currentQ]?.question}</p>
            </div>

            <div className="space-y-2">
              {questions[currentQ]?.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => handleAnswer(currentQ, i)}
                  className={`w-full text-left p-3 rounded-lg border-2 transition-all text-sm ${
                    answers[currentQ] === i ? 'border-[#F2CF7E] bg-[#F2CF7E]/10' : 'border-gray-200 hover:border-[#F2CF7E]/50'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCurrentQ(Math.max(0, currentQ - 1))
                  if (timeLimit > 0) setTimeRemaining(timeLimit)
                }}
                disabled={currentQ === 0}
                className="px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-white disabled:opacity-50"
              >
                <i className="ri-arrow-left-line" />
              </button>
              {currentQ < questions.length - 1 ? (
                <button
                  onClick={handleNextQuestion}
                  className="flex-1 py-2 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] text-sm"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] text-sm"
                >
                  Submit
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {showResults && (
          <div className="space-y-3">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-3xl font-bold text-black">{score}/{questions.length}</p>
              <p className="text-sm text-gray-600 mt-1">{Math.round((score/questions.length)*100)}% correct</p>
            </div>

            {/* Leaderboard - visible to all users */}
            {mode === 'host' && participants.length > 0 && (
              <div>
                <button
                  onClick={() => setShowLeaderboard(!showLeaderboard)}
                  className="w-full py-2 px-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] text-sm flex items-center justify-center gap-2"
                >
                  <i className="ri-trophy-line" />
                  {showLeaderboard ? 'Hide' : 'Show'} Leaderboard ({participants.length})
                  <i className={`ri-arrow-${showLeaderboard ? 'up' : 'down'}-s-line`} />
                </button>

                {showLeaderboard && (
                  <div className="mt-2 border-2 border-[#F2CF7E] rounded-lg overflow-hidden">
                    <div className="bg-[#F2CF7E] px-3 py-2">
                      <h4 className="text-xs font-bold text-black flex items-center">
                        <i className="ri-trophy-line mr-1" />
                        Leaderboard
                      </h4>
                    </div>
                    <div className="divide-y divide-gray-200 max-h-48 overflow-y-auto">
                      {sortedParticipants.map((participant, index) => (
                        <div key={index} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50 text-xs">
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                              index === 0 ? 'bg-yellow-400 text-yellow-900' :
                              index === 1 ? 'bg-gray-300 text-gray-700' :
                              index === 2 ? 'bg-orange-300 text-orange-900' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{participant.name}</div>
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
              </div>
            )}

            {/* Answer Review */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-gray-900">Answer Review</h4>
              {questions.map((q, i) => (
                <div key={i} className="p-3 rounded-lg border-2 border-gray-200 text-xs">
                  <p className="font-semibold mb-2">{i+1}. {q.question}</p>
                  {q.options.map((opt, j) => (
                    <div key={j} className={`p-2 rounded mb-1 ${
                      j === q.correct ? 'bg-green-100 text-green-800' :
                      answers[i] === j ? 'bg-red-100 text-red-800' : 'bg-gray-50'
                    }`}>
                      {opt} {j === q.correct && '✓'}
                    </div>
                  ))}
                  {q.explanation && (
                    <p className="text-xs text-gray-600 mt-2 italic">
                      <i className="ri-information-line mr-1" />
                      {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setQuestions([])
                setMode('select')
                setQuizCode('')
                setQuizStarted(false)
                setParticipants([])
                setShowLeaderboard(false)
              }}
              className="w-full py-2.5 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] text-sm"
            >
              <i className="ri-refresh-line mr-2" />
              New Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
