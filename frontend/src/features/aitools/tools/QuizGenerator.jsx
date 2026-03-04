import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../../../lib/api'

export default function QuizGenerator() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [numQuestions, setNumQuestions] = useState(10)
  const [difficulty, setDifficulty] = useState('medium')
  const [file, setFile] = useState(null)
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [answers, setAnswers] = useState({})
  const [showResults, setShowResults] = useState(false)

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
      setCurrentQ(0)
      setAnswers({})
      setShowResults(false)
    } catch (error) {
      alert('Failed to generate quiz. Please try again.')
    }
    setLoading(false)
  }

  const handleAnswer = (qIndex, optionIndex) => {
    setAnswers({ ...answers, [qIndex]: optionIndex })
  }

  const handleSubmit = () => {
    setShowResults(true)
  }

  const score = Object.entries(answers).filter(([qIdx, ans]) => 
    questions[qIdx]?.correct === ans
  ).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-emerald-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/ai-tools')} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50">
            <i className="ri-arrow-left-line text-xl" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Quiz Generator</h1>
            <p className="text-sm text-gray-500">Create custom practice tests</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
            <i className="ri-question-answer-line text-2xl text-white" />
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Generate Quiz</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                <input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g., World War II, Calculus, Python Programming"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload PDF (Optional)</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={e => setFile(e.target.files[0])}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number of Questions</label>
                  <input
                    type="number"
                    value={numQuestions}
                    onChange={e => setNumQuestions(parseInt(e.target.value))}
                    min="5"
                    max="20"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
                  <select
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-teal-500"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={loading || (!topic && !file)}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-medium hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating...' : 'Generate Quiz'}
              </button>
            </div>
          </div>
        ) : showResults ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-2xl font-bold text-center mb-4">Quiz Results</h2>
            <div className="text-center mb-6">
              <div className="text-5xl font-bold text-teal-600">{score}/{questions.length}</div>
              <p className="text-gray-600 mt-2">You got {Math.round((score/questions.length)*100)}% correct!</p>
            </div>
            {questions.map((q, i) => (
              <div key={i} className="mb-4 p-4 rounded-lg border border-gray-200">
                <p className="font-medium mb-2">{i+1}. {q.question}</p>
                {q.options.map((opt, j) => (
                  <div key={j} className={`p-2 rounded mb-1 ${
                    j === q.correct ? 'bg-green-100 text-green-800' :
                    answers[i] === j ? 'bg-red-100 text-red-800' : 'bg-gray-50'
                  }`}>
                    {opt} {j === q.correct && '✓'}
                  </div>
                ))}
                <p className="text-sm text-gray-600 mt-2">{q.explanation}</p>
              </div>
            ))}
            <button onClick={() => setQuestions([])} className="w-full py-3 rounded-lg bg-teal-600 text-white font-medium hover:bg-teal-700">
              Generate New Quiz
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Question {currentQ + 1} of {questions.length}</h2>
              <div className="text-sm text-gray-500">{Object.keys(answers).length}/{questions.length} answered</div>
            </div>
            <div className="mb-6">
              <p className="text-lg font-medium mb-4">{questions[currentQ]?.question}</p>
              <div className="space-y-2">
                {questions[currentQ]?.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswer(currentQ, i)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      answers[currentQ] === i
                        ? 'border-teal-500 bg-teal-50'
                        : 'border-gray-200 hover:border-teal-300'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                disabled={currentQ === 0}
                className="px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              {currentQ < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQ(currentQ + 1)}
                  className="flex-1 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={handleSubmit}
                  className="flex-1 py-2 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 text-white hover:opacity-90"
                >
                  Submit Quiz
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
