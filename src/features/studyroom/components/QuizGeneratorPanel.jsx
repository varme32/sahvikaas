import { useState, useRef, useEffect } from 'react'

export default function QuizGeneratorPanel() {
  const [file, setFile] = useState(null)
  const [numQuestions, setNumQuestions] = useState(10)
  const [timeMinutes, setTimeMinutes] = useState(15)
  const [stage, setStage] = useState('upload') // upload | ready | quiz | results
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [score, setScore] = useState(null)
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
    if (f) {
      setFile(f)
      // Simulate processing
      setTimeout(() => setStage('ready'), 1500)
    }
  }

  const startQuiz = () => {
    // Placeholder: In production, questions would be generated from the uploaded PDF
    setQuestions([])
    setAnswers({})
    setTimeLeft(timeMinutes * 60)
    setStage('quiz')
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
    setStage('upload')
    setQuestions([])
    setAnswers({})
    setScore(null)
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
        {/* Upload Stage */}
        {(stage === 'upload' || stage === 'ready') && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Upload PDF</label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Questions (5-20)</label>
                <input
                  type="number"
                  min={5} max={20}
                  value={numQuestions}
                  onChange={e => setNumQuestions(Number(e.target.value))}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Time (min)</label>
                <input
                  type="number"
                  min={5} max={60}
                  value={timeMinutes}
                  onChange={e => setTimeMinutes(Number(e.target.value))}
                  className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            {stage === 'ready' && (
              <p className="text-xs text-green-600 font-medium">
                <i className="ri-check-line mr-1" />
                PDF processed successfully!
              </p>
            )}
            <button
              onClick={stage === 'ready' ? startQuiz : () => fileRef.current?.click()}
              className={`w-full py-2 text-sm font-medium rounded-lg text-white transition-colors ${
                stage === 'ready' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {stage === 'ready' ? 'Start Quiz' : 'Generate Quiz'}
            </button>
          </div>
        )}

        {/* Quiz Stage */}
        {stage === 'quiz' && (
          <div className="space-y-4">
            <div className={`text-center text-sm font-mono font-bold ${timeLeft < 60 ? 'text-red-600' : 'text-gray-700'}`}>
              <i className="ri-timer-line mr-1" />
              {formatTime(timeLeft)}
            </div>
            {questions.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <i className="ri-questionnaire-line text-3xl" />
                <p className="text-sm mt-2">No questions generated yet</p>
                <p className="text-xs mt-1">Upload a PDF to generate quiz questions</p>
              </div>
            )}
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
                        type="radio"
                        name={`q${qi}`}
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
              className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
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
              <p className="text-sm text-gray-600 mt-2">
                {score.correct} / {score.total} correct
              </p>
            </div>

            {questions.map((q, qi) => {
              const isCorrect = answers[qi] === q.correct
              return (
                <div key={qi} className={`border rounded-lg p-3 ${isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {qi + 1}. {q.question}
                  </p>
                  <p className="text-xs text-gray-600">
                    Your answer: <span className={isCorrect ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                      {answers[qi] !== undefined ? q.options[answers[qi]] : 'Not answered'}
                    </span>
                  </p>
                  {!isCorrect && (
                    <p className="text-xs text-green-600 font-medium">
                      Correct: {q.options[q.correct]}
                    </p>
                  )}
                </div>
              )
            })}

            <button
              onClick={resetQuiz}
              className="w-full py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Take Another Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
