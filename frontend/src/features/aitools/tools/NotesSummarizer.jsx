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
    <div className="space-y-6">
      {/* Header Section - Full Width */}
      <div className="bg-[#F2CF7E] border-y border-[#e0bd6c] py-6 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 shadow-sm">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <button onClick={() => navigate('/ai-tools')} className="w-10 h-10 rounded-lg bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors">
            <i className="ri-arrow-left-line text-xl text-black" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-black">Notes Summarizer</h1>
            <p className="text-sm text-black/80 mt-1">Get concise summaries with key terms</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-black/10 flex items-center justify-center">
            <i className="ri-file-text-line text-xl text-black" />
          </div>
        </div>
      </div>

      {/* Main Content - Centered */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <form onSubmit={(e) => { e.preventDefault(); handleSummarize(); }}>
              <div className="p-6 sm:p-8 space-y-8">
                <div className="space-y-6">
                  <div className="pb-3 border-b-2 border-[#F2CF7E]">
                    <h2 className="text-lg font-bold text-gray-900">Input</h2>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Paste Your Notes
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Paste your notes here..."
                      rows={12}
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors resize-none"
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500 font-medium">OR</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                      Upload PDF
                    </label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={e => setFile(e.target.files[0])}
                      className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#F2CF7E] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#F2CF7E] file:text-black hover:file:bg-[#e0bd6c] file:cursor-pointer"
                    />
                    {file && (
                      <p className="text-xs text-gray-600 mt-2 flex items-center gap-1.5">
                        <i className="ri-file-pdf-line text-red-500" />
                        {file.name}
                      </p>
                    )}
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
                  disabled={loading || (!notes && !file)}
                  className="px-8 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin text-lg" />
                      Summarizing...
                    </>
                  ) : (
                    <>
                      <i className="ri-sparkling-line text-lg" />
                      Summarize Notes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Output Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="pb-3 border-b-2 border-[#F2CF7E]">
                <h2 className="text-lg font-bold text-gray-900">Summary</h2>
              </div>

              {summary ? (
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">{summary}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
                  <div className="w-20 h-20 rounded-full bg-[#F2CF7E]/20 flex items-center justify-center mb-4">
                    <i className="ri-file-text-line text-4xl text-[#F2CF7E]" />
                  </div>
                  <p className="text-sm font-medium">Your summary will appear here</p>
                  <p className="text-xs text-gray-400 mt-1">Paste notes or upload a PDF to get started</p>
                </div>
              )}
            </div>

            {summary && (
              <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E] flex items-center justify-end gap-3">
                <button
                  onClick={() => navigator.clipboard.writeText(summary)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-white hover:border-gray-400 transition-colors flex items-center gap-2"
                >
                  <i className="ri-file-copy-line" />
                  Copy
                </button>
                <button
                  onClick={() => setSummary('')}
                  className="px-6 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-colors flex items-center gap-2 shadow-md"
                >
                  <i className="ri-refresh-line" />
                  New Summary
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
