import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../../../lib/api'

export default function FlashcardGenerator() {
  const navigate = useNavigate()
  const [topic, setTopic] = useState('')
  const [content, setContent] = useState('')
  const [count, setCount] = useState(10)
  const [flashcards, setFlashcards] = useState([])
  const [loading, setLoading] = useState(false)
  const [currentCard, setCurrentCard] = useState(0)
  const [flipped, setFlipped] = useState(false)

  const handleGenerate = async () => {
    if (!topic) return
    setLoading(true)
    try {
      const res = await apiRequest('/api/ai/flashcards', {
        method: 'POST',
        body: { topic, content, count }
      })
      setFlashcards(res.flashcards || [])
      setCurrentCard(0)
      setFlipped(false)
    } catch (error) {
      alert('Failed to generate flashcards. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header Section - Full Width */}
      <div className="bg-[#F2CF7E] border-y border-[#e0bd6c] py-6 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 shadow-sm">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <button onClick={() => navigate('/ai-tools')} className="w-10 h-10 rounded-lg bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors">
            <i className="ri-arrow-left-line text-xl text-black" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-black">Flashcard Generator</h1>
            <p className="text-sm text-black/80 mt-1">Auto-create flashcards from any content</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-black/10 flex items-center justify-center">
            <i className="ri-stack-line text-xl text-black" />
          </div>
        </div>
      </div>

      {/* Main Content - Centered */}
      <div className="max-w-4xl mx-auto">
        {flashcards.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}>
              <div className="p-6 sm:p-8 space-y-8">
                {/* Input Section */}
                <div className="space-y-6">
                  <div className="pb-3 border-b-2 border-[#F2CF7E]">
                    <h2 className="text-lg font-bold text-gray-900">Flashcard Details</h2>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Topic <span className="text-[#F2CF7E]">*</span>
                    </label>
                    <input
                      value={topic}
                      onChange={e => setTopic(e.target.value)}
                      placeholder="e.g., Spanish Vocabulary, Biology Terms"
                      className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Content <span className="text-gray-500 font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="Paste your study material here for more specific flashcards..."
                      rows={6}
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Number of Cards: {count}
                    </label>
                    <input
                      type="range"
                      value={count}
                      onChange={e => setCount(parseInt(e.target.value))}
                      min="5"
                      max="20"
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#F2CF7E]"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>5 cards</span>
                      <span>20 cards</span>
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
                  disabled={loading || !topic}
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
                      Generate Flashcards
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8">
              <div className="text-center text-sm text-gray-600 mb-6 font-medium">
                Card {currentCard + 1} of {flashcards.length}
              </div>
              <div
                onClick={() => setFlipped(!flipped)}
                className="relative h-80 cursor-pointer perspective-1000"
              >
                <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}>
                  <div className="absolute w-full h-full backface-hidden">
                    <div className="bg-white rounded-2xl border-2 border-[#F2CF7E] shadow-lg p-8 h-full flex flex-col items-center justify-center">
                      <div className="text-xs font-bold text-black/70 mb-4 uppercase tracking-wider">FRONT</div>
                      <div className="text-2xl font-bold text-center text-gray-900">{flashcards[currentCard]?.front}</div>
                      <div className="text-xs text-gray-400 mt-6">Click to flip</div>
                    </div>
                  </div>
                  <div className="absolute w-full h-full backface-hidden rotate-y-180">
                    <div className="bg-[#F2CF7E] rounded-2xl shadow-lg p-8 h-full flex flex-col items-center justify-center">
                      <div className="text-xs font-bold text-black/70 mb-4 uppercase tracking-wider">BACK</div>
                      <div className="text-xl text-center text-black font-medium">{flashcards[currentCard]?.back}</div>
                      <div className="text-xs text-black/60 mt-6">Click to flip</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Footer */}
            <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E] flex gap-3">
              <button
                onClick={() => { setCurrentCard(Math.max(0, currentCard - 1)); setFlipped(false); }}
                disabled={currentCard === 0}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-white hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <i className="ri-arrow-left-line mr-2" />
                Previous
              </button>
              <button
                onClick={() => { setCurrentCard(Math.min(flashcards.length - 1, currentCard + 1)); setFlipped(false); }}
                disabled={currentCard === flashcards.length - 1}
                className="flex-1 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                Next
                <i className="ri-arrow-right-line ml-2" />
              </button>
              <button
                onClick={() => setFlashcards([])}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-white hover:border-gray-400 transition-colors"
              >
                <i className="ri-refresh-line mr-2" />
                New Set
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
