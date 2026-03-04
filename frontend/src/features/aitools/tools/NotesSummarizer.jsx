import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest } from '../../../lib/api'

export default function NotesSummarizer() {
  const navigate = useNavigate()
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState(null)
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSummarize = async () => {
    if (!notes && !file) return
    setLoading(true)
    try {
      const formData = new FormData()
      if (file) formData.append('pdf', file)
      formData.append('notes', notes)
      
      const res = await apiRequest('/api/ai/summarize', {
        method: 'POST',
        body: formData
      })
      setSummary(res.summary)
    } catch (error) {
      alert('Failed to summarize. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/ai-tools')} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50">
            <i className="ri-arrow-left-line text-xl" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Notes Summarizer</h1>
            <p className="text-sm text-gray-500">Get concise summaries with key terms</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <i className="ri-file-text-line text-2xl text-white" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Input</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Paste Your Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Paste your notes here..."
                  rows={12}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 resize-none"
                />
              </div>
              <div className="text-center text-sm text-gray-500">OR</div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Upload PDF</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={e => setFile(e.target.files[0])}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200"
                />
              </div>
              <button
                onClick={handleSummarize}
                disabled={loading || (!notes && !file)}
                className="w-full py-3 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Summarizing...' : 'Summarize Notes'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Summary</h2>
            {summary ? (
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-700">{summary}</div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <i className="ri-file-text-line text-5xl mb-3" />
                <p>Your summary will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
