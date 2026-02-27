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
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/ai-tools')} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50">
            <i className="ri-arrow-left-line text-xl" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Flashcard Generator</h1>
            <p className="text-sm text-gray-500">Auto-create flashcards from any content</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
            <i className="ri-stack-line text-2xl text-white" />
          </div>
        </div>

        {flashcards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Generate Flashcards</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                <input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="e.g., Spanish Vocabulary, Biology Terms"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content (Optional)</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Paste your study material here for more specific flashcards..."
                  rows={6}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Cards: {count}</label>
                <input
                  type="range"
                  value={count}
                  onChange={e => setCount(parseInt(e.target.value))}
                  min="5"
                  max="20"
                  className="w-full"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={loading || !topic}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 text-white font-medium hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Generating...' : 'Generate Flashcards'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center text-sm text-gray-600">
              Card {currentCard + 1} of {flashcards.length}
            </div>
            <div
              onClick={() => setFlipped(!flipped)}
              className="relative h-80 cursor-pointer perspective-1000"
            >
              <div className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}>
                <div className="absolute w-full h-full backface-hidden">
                  <div className="bg-white rounded-2xl border-2 border-pink-500 shadow-lg p-8 h-full flex flex-col items-center justify-center">
                    <div className="text-xs font-medium text-pink-600 mb-4">FRONT</div>
                    <div className="text-2xl font-bold text-center">{flashcards[currentCard]?.front}</div>
                    <div className="text-xs text-gray-400 mt-6">Click to flip</div>
                  </div>
                </div>
                <div className="absolute w-full h-full backface-hidden rotate-y-180">
                  <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl shadow-lg p-8 h-full flex flex-col items-center justify-center text-white">
                    <div className="text-xs font-medium mb-4">BACK</div>
                    <div className="text-xl text-center">{flashcards[currentCard]?.back}</div>
                    <div className="text-xs opacity-80 mt-6">Click to flip</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setCurrentCard(Math.max(0, currentCard - 1)); setFlipped(false); }}
                disabled={currentCard === 0}
                className="px-6 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => { setCurrentCard(Math.min(flashcards.length - 1, currentCard + 1)); setFlipped(false); }}
                disabled={currentCard === flashcards.length - 1}
                className="flex-1 py-3 rounded-lg bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50"
              >
                Next
              </button>
              <button
                onClick={() => setFlashcards([])}
                className="px-6 py-3 rounded-lg border border-gray-200 hover:bg-gray-50"
              >
                New Set
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
