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
    <div className="space-y-6">
      {/* Header Section - Full Width */}
      <div className="bg-[#F2CF7E] border-y border-[#e0bd6c] py-6 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 shadow-sm">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <button onClick={() => navigate('/ai-tools')} className="w-10 h-10 rounded-lg bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors">
            <i className="ri-arrow-left-line text-xl text-black" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-black">Quiz Generator</h1>
            <p className="text-sm text-black/80 mt-1">Create custom practice tests</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-black/10 flex items-center justify-center">
            <i className="ri-question-answer-line text-xl text-black" />
          </div>
        </div>
      </div>

      {/* Main Content - Centered */}
      <div className="max-w-4xl mx-auto">
        {questions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}>
              <div className="p-6 sm:p-8 space-y-8">
                {/* Quiz Details Section */}
                <div className="space-y-6">
                  <div className="pb-3 border-b-2 border-[#F2CF7E]">
                    <h2 className="text-lg font-bold text-gray-900">Quiz Details</h2>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Topic <span className="text-[#F2CF7E]">*</span>
                    </label>
                    <input
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      placeholder="e.g., World War II, Calculus, Python Programming"
                      className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Upload PDF <span className="text-gray-500 font-normal">(optional)</span>
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={e => setFile(e.target.files[0])}
                      className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#F2CF7E] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#F2CF7E] file:text-black hover:file:bg-[#e0bd6c] file:cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        Difficulty
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
                  </div>
                </div>
              </div>

              {/* Form Footer */}
              <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/ai-tools')}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-white hover:border-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
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
            </form>
          </div>
        ) : showResults ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8">
              <h2 className="text-2xl font-bold text-center mb-4">Quiz Results</h2>
              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-black">{score}/{questions.length}</div>
                <p className="text-gray-600 mt-2">You got {Math.round((score/questions.length)*100)}% correct!</p>
              </div>
              {questions.map((q, i) => (
                <div key={i} className="mb-4 p-4 rounded-lg border-2 border-gray-200">
                  <p className="font-semibold mb-2">{i+1}. {q.question}</p>
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
            <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E]">
              <button onClick={() => setQuestions([])} className="w-full py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-colors shadow-md">
                <i className="ri-refresh-line mr-2" />
                Generate New Quiz
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-900">Question {currentQ + 1} of {questions.length}</h2>
                <div className="text-sm text-gray-500 font-medium">{Object.keys(answers).length}/{questions.length} answered</div>
              </div>
              <div className="mb-6">
                <p className="text-lg font-semibold mb-4 text-gray-900">{questions[currentQ]?.question}</p>
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
                onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                disabled={currentQ === 0}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-white hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-arrow-left-line mr-2" />
                Previous
              </button>
              {currentQ < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQ(currentQ + 1)}
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
      </div>
    </div>
  )
}
