import { useState, useRef } from 'react'
import { summarizePdf } from '../../../lib/api'

export default function PdfSummarizerPanel() {
  const [file, setFile] = useState(null)
  const [summary, setSummary] = useState('')
  const [processing, setProcessing] = useState(false)
  const [processingMsg, setProcessingMsg] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const handleFile = (f) => {
    if (!f || !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file.')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10MB.')
      return
    }
    setFile(f)
    setError('')
    processPdf(f)
  }

  const processPdf = async (f) => {
    setProcessing(true)
    setProcessingMsg('Uploading PDF...')

    try {
      setProcessingMsg('Extracting text & generating AI summary...')
      const data = await summarizePdf(f)
      setSummary(data.summary)
    } catch (err) {
      setError(`Failed to summarize: ${err.message}. Make sure the backend is running.`)
    } finally {
      setProcessing(false)
      setProcessingMsg('')
    }
  }

  const clearSummary = () => {
    setFile(null)
    setSummary('')
    setProcessingMsg('')
    setError('')
  }

  const copySummary = () => {
    navigator.clipboard.writeText(summary)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const f = e.dataTransfer.files[0]
    handleFile(f)
  }

  const renderSummary = (text) => {
    return text.split('\n').map((line, i) => {
      let processed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      processed = processed.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-xs">$1</code>')
      if (processed.startsWith('- ') || processed.startsWith('* ')) {
        processed = '&nbsp;&nbsp;• ' + processed.slice(2)
      }
      if (processed.trim() === '') return <br key={i} />
      return <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: processed }} />
    })
  }

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

        {!summary && !processing && (
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            <i className="ri-file-pdf-2-line text-4xl text-red-400" />
            <p className="text-sm font-medium text-gray-600 mt-2">Drop PDF here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Max: 10MB • AI-powered summary</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {processing && (
          <div className="text-center py-12">
            <i className="ri-loader-4-line animate-spin text-3xl text-[#F2CF7E]" />
            <p className="text-sm text-gray-600 mt-3">{processingMsg}</p>
            <p className="text-xs text-gray-400 mt-1">This may take a moment depending on PDF size...</p>
          </div>
        )}

        {summary && !processing && (
          <div className="border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
              <div className="flex items-center gap-2">
                <i className="ri-file-pdf-2-line text-red-500" />
                <h4 className="text-sm font-semibold text-gray-700">{file?.name || 'Document Summary'}</h4>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copySummary} className="text-xs text-black hover:text-[#e0bd6c] font-medium flex items-center gap-1">
                  <i className="ri-file-copy-line" />Copy
                </button>
                <button onClick={clearSummary} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium">
                  <i className="ri-delete-bin-line" />Clear
                </button>
              </div>
            </div>
            <div className="p-3 max-h-[60vh] overflow-y-auto scrollbar-thin">
              <div className="text-sm text-gray-700 leading-relaxed">
                {renderSummary(summary)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

