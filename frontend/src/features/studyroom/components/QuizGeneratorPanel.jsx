import { useState, useRef, useEffect } from 'react'
import { generateQuiz } from '../../../lib/api'

export default function QuizGeneratorPanel() {
  const [file, setFile] = useState(null)
  const [topic, setTopic] = useState('')
  const [numQuestions, setNumQuestions] = useState(10)
  const [timeMinutes, setTimeMinutes] = useState(15)
  const [stage, setStage] = useState('upload') // upload | loading | quiz | results
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [score, setScore] = useState(null)
  const [error, setError] = useState('')
  const timerRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    if (stage === 'quiz' && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            handleSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timerRef.current)
    }
  }, [stage])

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
      setAnswers({})
      setTimeLeft(timeMinutes * 60)
      setStage('quiz')
    } catch (err) {
      setError(`Failed to generate quiz: ${err.message}`)
      setStage('upload')
    }
  }

  const handleSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    let correct = 0
    questions.forEach((q, i) => {
      if (answers[i] === q.correct) correct++
    })
    setScore({ correct, total: questions.length })
    setStage('results')
  }

  const resetQuiz = () => {
    setFile(null)
    setTopic('')
    setStage('upload')
    setQuestions([])
    setAnswers({})
    setScore(null)
    setError('')
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Upload PDF (optional)</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
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
                className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Questions (5-20)</label>
                <input
                  type="number" min={5} max={20}
                  value={numQuestions}
                  onChange={e => setNumQuestions(Math.min(20, Math.max(5, Number(e.target.value))))}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Time (min)</label>
                <input
                  type="number" min={5} max={60}
                  value={timeMinutes}
                  onChange={e => setTimeMinutes(Math.min(60, Math.max(5, Number(e.target.value))))}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              onClick={startQuiz}
              className="w-full py-2.5 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <i className="ri-questionnaire-line" />
              Generate Quiz with AI
            </button>
          </div>
        )}

        {/* Loading Stage */}
        {stage === 'loading' && (
          <div className="text-center py-12">
            <i className="ri-loader-4-line animate-spin text-3xl text-indigo-500" />
            <p className="text-sm text-gray-600 mt-3">Generating quiz questions with AI...</p>
            <p className="text-xs text-gray-400 mt-1">This may take a moment</p>
          </div>
        )}

        {/* Quiz Stage */}
        {stage === 'quiz' && (
          <div className="space-y-4">
            <div className="sticky top-0 bg-white py-2 z-10 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{Object.keys(answers).length} / {questions.length} answered</span>
                <span className={`text-sm font-mono font-bold ${timeLeft < 60 ? 'text-red-600 animate-pulse' : 'text-gray-700'}`}>
                  <i className="ri-timer-line mr-1" />{formatTime(timeLeft)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1 mt-1.5">
                <div
                  className="bg-indigo-600 h-1 rounded-full transition-all"
                  style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}
                />
              </div>
            </div>

            {questions.map((q, qi) => (
              <div key={qi} className="border border-gray-200 rounded-lg p-3">
                <p className="text-sm font-medium text-gray-900 mb-2">
                  {qi + 1}. {q.question}
                </p>
                <div className="space-y-1.5">
                  {q.options.map((opt, oi) => (
                    <label
                      key={oi}
                      className={`flex items-center gap-2 p-2 rounded-lg text-sm cursor-pointer transition-colors ${
                        answers[qi] === oi ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <input
                        type="radio" name={`q${qi}`}
                        checked={answers[qi] === oi}
                        onChange={() => setAnswers(prev => ({ ...prev, [qi]: oi }))}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <button
              onClick={handleSubmit}
              className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Submit Quiz
            </button>
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

            {questions.map((q, qi) => {
              const isCorrect = answers[qi] === q.correct
              return (
                <div key={qi} className={`border rounded-lg p-3 ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {isCorrect ? '✅' : '❌'} {qi + 1}. {q.question}
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

            <button onClick={resetQuiz} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
              Take Another Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
