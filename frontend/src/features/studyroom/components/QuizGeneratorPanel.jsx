import { useState, useRef, useEffect } from 'react'
import { generateQuiz } from '../../../lib/api'
import { getSocket } from '../../../lib/socket'

// Render question text — splits out fenced code blocks for proper display
function renderQuestion(text) {
  if (!text) return null
  const parts = text.split(/(```[\w]*\n[\s\S]*?```)/g)
  return parts.map((part, i) => {
    const codeMatch = part.match(/^```([\w]*)\n([\s\S]*?)```$/)
    if (codeMatch) {
      return (
        <pre key={i} className="mt-2 mb-1 bg-gray-900 text-green-300 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">
          <code>{codeMatch[2]}</code>
        </pre>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export default function QuizGeneratorPanel({ roomId, userName, isHost, activeQuiz, quizResults }) {
  const [file, setFile] = useState(null)
  const [topic, setTopic] = useState('')
  const [numQuestions, setNumQuestions] = useState(10)
  const [timeMinutes, setTimeMinutes] = useState(15)
  const [perQuestionSeconds, setPerQuestionSeconds] = useState(30) // per-question timer
  const [usePerQuestion, setUsePerQuestion] = useState(false) // toggle per-question vs overall
  const [stage, setStage] = useState('upload') // upload | loading | quiz | results
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentQ, setCurrentQ] = useState(0) // current question index for per-question mode
  const [timeLeft, setTimeLeft] = useState(0) // overall timer
  const [qTimeLeft, setQTimeLeft] = useState(0) // per-question timer
  const [score, setScore] = useState(null)
  const [error, setError] = useState('')
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const timerRef = useRef(null)
  const qTimerRef = useRef(null)
  const fileRef = useRef(null)
  const answersRef = useRef(answers)
  const questionsRef = useRef(questions)
  const currentQRef = useRef(currentQ)

  // Keep refs in sync so timer callbacks always have latest values
  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { questionsRef.current = questions }, [questions])
  useEffect(() => { currentQRef.current = currentQ }, [currentQ])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (qTimerRef.current) clearInterval(qTimerRef.current)
    }
  }, [])

  // When an active quiz is broadcast, participants auto-enter quiz mode
  // Also handles initial mount when activeQuiz is already set (late joiners)
  useEffect(() => {
    if (activeQuiz && !hasSubmitted) {
      setQuestions(activeQuiz.questions)
      questionsRef.current = activeQuiz.questions
      setAnswers({})
      setCurrentQ(0)
      currentQRef.current = 0
      setTimeLeft(activeQuiz.timeMinutes * 60)
      setScore(null)
      setStage('quiz')
    }
    if (!activeQuiz && stage === 'quiz') {
      if (!hasSubmitted) doSubmit()
    }
  }, [activeQuiz])

  // Reset hasSubmitted when a new quiz starts
  useEffect(() => {
    if (activeQuiz) setHasSubmitted(false)
  }, [activeQuiz?.id])

  // Overall countdown timer (when not using per-question mode)
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (stage === 'quiz' && timeLeft > 0 && !usePerQuestion) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            doSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [stage, usePerQuestion])

  // Per-question countdown timer
  useEffect(() => {
    if (qTimerRef.current) clearInterval(qTimerRef.current)
    if (stage === 'quiz' && usePerQuestion && qTimeLeft > 0) {
      qTimerRef.current = setInterval(() => {
        setQTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(qTimerRef.current)
            // Auto-advance to next question or submit if last
            const qs = questionsRef.current
            const cq = currentQRef.current
            if (cq < qs.length - 1) {
              const next = cq + 1
              setCurrentQ(next)
              currentQRef.current = next
              setQTimeLeft(perQuestionSeconds)
              return perQuestionSeconds
            } else {
              doSubmit()
              return 0
            }
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(qTimerRef.current)
  }, [stage, usePerQuestion, currentQ])

  const handleFileUpload = (e) => {
    const f = e.target.files[0]
    if (f) setFile(f)
  }

  const startQuiz = async () => {
    if (!file && !topic.trim()) {
      setError('Please upload a PDF or enter a topic.')
      return
    }
    setError('')
    setStage('loading')

    try {
      const data = await generateQuiz(file, numQuestions, topic.trim())
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No questions generated. Try a different PDF or topic.')
      }
      setQuestions(data.questions)
      questionsRef.current = data.questions
      setAnswers({})
      setCurrentQ(0)
      currentQRef.current = 0
      setTimeLeft(timeMinutes * 60)
      if (usePerQuestion) setQTimeLeft(perQuestionSeconds)
      setStage('quiz')

      // Broadcast quiz to all participants via socket
      const socket = getSocket()
      if (socket?.connected && roomId) {
        socket.emit('quiz-start', {
          meetingId: roomId,
          quiz: {
            id: Date.now().toString(),
            questions: data.questions,
            timeMinutes,
            perQuestionSeconds: usePerQuestion ? perQuestionSeconds : 0,
            createdBy: userName,
          },
        })
      }
    } catch (err) {
      setError(`Failed to generate quiz: ${err.message}`)
      setStage('upload')
    }
  }

  const startPersonalQuiz = async () => {
    if (!file && !topic.trim()) {
      setError('Please upload a PDF or enter a topic.')
      return
    }
    setError('')
    setStage('loading')

    try {
      const data = await generateQuiz(file, numQuestions, topic.trim())
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No questions generated. Try a different PDF or topic.')
      }
      setQuestions(data.questions)
      questionsRef.current = data.questions
      setAnswers({})
      setCurrentQ(0)
      currentQRef.current = 0
      setTimeLeft(timeMinutes * 60)
      if (usePerQuestion) setQTimeLeft(perQuestionSeconds)
      setStage('quiz')
    } catch (err) {
      setError(`Failed to generate quiz: ${err.message}`)
      setStage('upload')
    }
  }

  // Use a stable ref-based submit so timers can call it without stale closures
  const doSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (qTimerRef.current) clearInterval(qTimerRef.current)
    const currentAnswers = answersRef.current
    const currentQuestions = questionsRef.current.length > 0
      ? questionsRef.current
      : (activeQuiz?.questions || [])
    let correct = 0
    currentQuestions.forEach((q, i) => {
      if (currentAnswers[i] === q.correct) correct++
    })
    const result = { correct, total: currentQuestions.length }
    setScore(result)
    setStage('results')
    setHasSubmitted(true)

    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('quiz-submit', {
        meetingId: roomId,
        result: {
          userName,
          score: correct,   // backend sorts by .score
          correct,
          total: currentQuestions.length,
          percentage: Math.round((correct / currentQuestions.length) * 100),
          answers: currentAnswers,
        },
      })
    }
  }

  // Wrapper so JSX onClick still works
  const handleSubmit = () => doSubmit()

  const resetQuiz = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (qTimerRef.current) clearInterval(qTimerRef.current)
    setFile(null)
    setTopic('')
    setStage('upload')
    setQuestions([])
    setAnswers({})
    setCurrentQ(0)
    setScore(null)
    setError('')
    setHasSubmitted(false)
  }

  const endQuizForAll = () => {
    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('quiz-end', { meetingId: roomId })
    }
    resetQuiz()
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const pct = score ? Math.round((score.correct / score.total) * 100) : 0

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <i className="ri-error-warning-line shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto shrink-0"><i className="ri-close-line" /></button>
          </div>
        )}

        {/* Upload / Config Stage */}
        {stage === 'upload' && (
          <div className="space-y-4">
            {/* Show leaderboard from previous quiz if results exist */}
            {quizResults && quizResults.length > 0 && (
              <div className="mb-4 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                  <i className="ri-trophy-line text-yellow-600" />
                  Last Quiz Results
                </h4>
                <div className="space-y-1.5">
                  {quizResults
                    .sort((a, b) => b.percentage - a.percentage)
                    .map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="flex-1 font-medium text-gray-700">{r.userName}</span>
                      <span className={`font-semibold ${r.percentage >= 70 ? 'text-green-600' : r.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {r.percentage}% ({r.correct}/{r.total})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Upload PDF (optional)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[#F2CF7E]/10 file:text-black hover:file:bg-[#F2CF7E]/20"
              />
              {file && (
                <p className="text-xs text-green-600 font-medium mt-1">
                  <i className="ri-check-line mr-1" />{file.name} selected
                </p>
              )}
            </div>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">OR</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Enter a topic</label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="e.g., Data Structures, Photosynthesis..."
                className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Questions (5-20)</label>
                <input
                  type="number" min={5} max={20}
                  value={numQuestions}
                  onChange={e => setNumQuestions(Math.min(20, Math.max(5, Number(e.target.value))))}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Time (min)</label>
                <input
                  type="number" min={5} max={60}
                  value={timeMinutes}
                  onChange={e => setTimeMinutes(Math.min(60, Math.max(5, Number(e.target.value))))}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E]"
                />
              </div>
            </div>

            {/* Timer mode toggle */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">Per-question timer (auto-advance)</span>
                <button
                  onClick={() => setUsePerQuestion(v => !v)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${usePerQuestion ? 'bg-[#F2CF7E]' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${usePerQuestion ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
              {usePerQuestion && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 shrink-0">Seconds per question:</label>
                  <select
                    value={perQuestionSeconds}
                    onChange={e => setPerQuestionSeconds(Number(e.target.value))}
                    className="flex-1 h-8 px-2 border border-gray-200 rounded text-xs focus:outline-none focus:border-[#F2CF7E]"
                  >
                    <option value={15}>15s</option>
                    <option value={30}>30s</option>
                    <option value={45}>45s</option>
                    <option value={60}>1 min</option>
                    <option value={90}>1.5 min</option>
                    <option value={120}>2 min</option>
                  </select>
                </div>
              )}
            </div>

            {/* Host can broadcast quiz to all */}
            {isHost && (
              <button
                onClick={startQuiz}
                className="w-full py-2.5 text-sm font-medium rounded-lg text-white bg-[#F2CF7E] hover:bg-[#e0bd6c] transition-colors flex items-center justify-center gap-2"
              >
                <i className="ri-broadcast-line" />
                Generate & Send to All Participants
              </button>
            )}

            {/* Everyone can do personal practice */}
            <button
              onClick={startPersonalQuiz}
              className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                isHost
                  ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  : 'text-white bg-[#F2CF7E] hover:bg-[#e0bd6c]'
              }`}
            >
              <i className="ri-questionnaire-line" />
              {isHost ? 'Practice Solo' : 'Generate Quiz with AI'}
            </button>
          </div>
        )}

        {/* Loading Stage */}
        {stage === 'loading' && (
          <div className="text-center py-12">
            <i className="ri-loader-4-line animate-spin text-3xl text-[#F2CF7E]" />
            <p className="text-sm text-gray-600 mt-3">Generating quiz questions with AI...</p>
            <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
          </div>
        )}

        {/* Quiz Stage */}
        {stage === 'quiz' && (
          <div className="space-y-4">
            <div className="sticky top-0 bg-white py-2 z-10 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {usePerQuestion
                    ? `Q ${currentQ + 1} / ${questions.length}`
                    : `${Object.keys(answers).length} / ${questions.length} answered`}
                </span>
                <div className="flex items-center gap-2">
                  {/* Per-question countdown */}
                  {usePerQuestion && (
                    <span className={`text-sm font-mono font-bold px-2 py-0.5 rounded ${qTimeLeft <= 5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-[#F2CF7E]/20 text-gray-700'}`}>
                      <i className="ri-time-line mr-1" />{qTimeLeft}s
                    </span>
                  )}
                  {/* Overall countdown */}
                  {!usePerQuestion && (
                    <span className={`text-sm font-mono font-bold ${timeLeft < 60 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
                      <i className="ri-timer-line mr-1" />{formatTime(timeLeft)}
                    </span>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-1 mt-1.5">
                <div
                  className="bg-[#F2CF7E] h-1 rounded-full transition-all"
                  style={{ width: usePerQuestion
                    ? `${((currentQ + 1) / questions.length) * 100}%`
                    : `${(Object.keys(answers).length / questions.length) * 100}%`
                  }}
                />
              </div>
              {activeQuiz && (
                <p className="text-xs text-blue-600 mt-1">
                  <i className="ri-broadcast-line mr-1" />
                  Quiz by {activeQuiz.createdBy}
                </p>
              )}
            </div>

            {/* Per-question mode: show one question at a time */}
            {usePerQuestion ? (
              <div className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  {currentQ + 1}. {renderQuestion(questions[currentQ]?.question)}
                </p>
                <div className="space-y-1.5">
                  {questions[currentQ]?.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={`flex items-center gap-2 p-2 rounded-lg text-sm cursor-pointer transition-colors ${
                        answers[currentQ] === oi ? 'bg-[#F2CF7E]/10 border border-[#F2CF7E]/30' : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="radio" name={`q${currentQ}`}
                        checked={answers[currentQ] === oi}
                        onChange={() => setAnswers(prev => ({ ...prev, [currentQ]: oi }))}
                        className="text-black focus:ring-[#F2CF7E]"
                      />
                      <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => { setCurrentQ(q => Math.max(0, q - 1)); setQTimeLeft(perQuestionSeconds) }}
                    disabled={currentQ === 0}
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 disabled:opacity-40"
                  >
                    <i className="ri-arrow-left-line" />
                  </button>
                  {currentQ < questions.length - 1 ? (
                    <button
                      onClick={() => { setCurrentQ(q => q + 1); setQTimeLeft(perQuestionSeconds) }}
                      className="flex-1 py-1.5 bg-[#F2CF7E] text-black text-xs font-medium rounded-lg hover:bg-[#e0bd6c]"
                    >
                      Next <i className="ri-arrow-right-line ml-1" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      className="flex-1 py-1.5 bg-[#F2CF7E] text-black text-xs font-medium rounded-lg hover:bg-[#e0bd6c]"
                    >
                      Submit Quiz
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* Overall timer mode: show all questions */
              <>
                {questions.map((q, qi) => (
                  <div key={qi} className="border border-gray-200 rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-900 mb-2">
                      {qi + 1}. {renderQuestion(q.question)}
                    </p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, oi) => (
                        <label
                          key={oi}
                          className={`flex items-center gap-2 p-2 rounded-lg text-sm cursor-pointer transition-colors ${
                            answers[qi] === oi ? 'bg-[#F2CF7E]/10 border border-[#F2CF7E]/30' : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <input
                            type="radio" name={`q${qi}`}
                            checked={answers[qi] === oi}
                            onChange={() => setAnswers(prev => ({ ...prev, [qi]: oi }))}
                            className="text-black focus:ring-[#F2CF7E]"
                          />
                          <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  onClick={handleSubmit}
                  className="w-full py-2.5 bg-[#F2CF7E] text-white text-sm font-medium rounded-lg hover:bg-[#e0bd6c] transition-colors"
                >
                  Submit Quiz
                </button>
              </>
            )}
          </div>
        )}

        {/* Results Stage */}
        {stage === 'results' && score && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full text-xl font-bold text-white ${
                pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}>
                {pct}%
              </div>
              <p className="text-sm text-gray-600 mt-2">{score.correct} / {score.total} correct</p>
              <p className="text-xs text-gray-400 mt-1">
                {pct >= 90 ? '🎉 Excellent!' : pct >= 70 ? '👏 Great job!' : pct >= 50 ? '💪 Keep practicing!' : '📖 Review the material'}
              </p>
            </div>

            {/* Live Leaderboard */}
            {quizResults && quizResults.length > 0 && (
              <div className="p-3 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
                <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                  <i className="ri-trophy-line text-yellow-600" />
                  Live Leaderboard ({quizResults.length} submitted)
                </h4>
                <div className="space-y-1.5">
                  {quizResults
                    .sort((a, b) => b.percentage - a.percentage)
                    .map((r, i) => (
                    <div key={i} className={`flex items-center gap-2 text-sm p-1.5 rounded ${r.userName === userName ? 'bg-white/60' : ''}`}>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {i + 1}
                      </span>
                      <span className="flex-1 font-medium text-gray-700">
                        {r.userName}
                        {r.userName === userName && <span className="text-[10px] ml-1 text-blue-600">(You)</span>}
                      </span>
                      <span className={`font-semibold ${r.percentage >= 70 ? 'text-green-600' : r.percentage >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {r.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {questions.map((q, qi) => {
              const isCorrect = answers[qi] === q.correct
              return (
                <div key={qi} className={`border rounded-lg p-3 ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {isCorrect ? '✅' : '❌'} {qi + 1}. {renderQuestion(q.question)}
                  </p>
                  <p className="text-xs text-gray-600">
                    Your answer: <span className={isCorrect ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {answers[qi] !== undefined ? q.options[answers[qi]] : 'Not answered'}
                    </span>
                  </p>
                  {!isCorrect && (
                    <p className="text-xs text-green-600 font-medium mt-0.5">Correct: {q.options[q.correct]}</p>
                  )}
                  {q.explanation && (
                    <p className="text-xs text-gray-500 mt-1 italic">💡 {q.explanation}</p>
                  )}
                </div>
              )
            })}

            <div className="flex gap-2">
              {isHost && activeQuiz && (
                <button onClick={endQuizForAll} className="flex-1 py-2.5 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors">
                  End Quiz for All
                </button>
              )}
              <button onClick={resetQuiz} className="flex-1 py-2.5 bg-[#F2CF7E] text-white text-sm font-medium rounded-lg hover:bg-[#e0bd6c] transition-colors">
                {activeQuiz ? 'Back to Quiz Setup' : 'Take Another Quiz'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

