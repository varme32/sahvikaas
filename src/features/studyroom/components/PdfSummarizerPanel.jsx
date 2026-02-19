import { useState, useRef } from 'react'

export default function PdfSummarizerPanel() {
  const [file, setFile] = useState(null)
  const [summary, setSummary] = useState('')
  const [processing, setProcessing] = useState(false)
  const [processingMsg, setProcessingMsg] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const fileRef = useRef(null)

  const handleFile = (f) => {
    if (!f || !f.name.endsWith('.pdf')) return
    if (f.size > 10 * 1024 * 1024) {
      alert('File too large. Max 10MB.')
      return
    }
    setFile(f)
    processPdf(f)
  }

  const processPdf = async (f) => {
    setProcessing(true)
    setProcessingMsg('Processing PDF...')
    // Simulate extraction
    await new Promise(r => setTimeout(r, 800))
    setProcessingMsg('Extracting text from pages...')
    await new Promise(r => setTimeout(r, 1000))
    setProcessingMsg('Generating summary...')
    await new Promise(r => setTimeout(r, 1200))
    setSummary(
      `**Summary of "${f.name}"**\n\n` +
      `This document covers several key topics:\n\n` +
      `• **Introduction** - Overview of the subject matter and objectives\n` +
      `• **Core Concepts** - Detailed explanation of fundamental principles\n` +
      `• **Applications** - Real-world use cases and implementations\n` +
      `• **Conclusion** - Summary of findings and future directions\n\n` +
      `The document provides a comprehensive overview with detailed examples and references for further study.`
    )
    setProcessing(false)
  }

  const clearSummary = () => {
    setFile(null)
    setSummary('')
    setProcessingMsg('')
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

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
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
            <i className="ri-upload-cloud-2-line text-4xl text-gray-400" />
            <p className="text-sm font-medium text-gray-600 mt-2">Drop PDF here</p>
            <p className="text-xs text-gray-400 mt-1">or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Max: 10MB</p>
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
            <i className="ri-loader-4-line animate-spin text-3xl text-indigo-500" />
            <p className="text-sm text-gray-600 mt-3">{processingMsg}</p>
          </div>
        )}

        {summary && !processing && (
          <div className="border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700">Document Summary</h4>
              <div className="flex items-center gap-2">
                <button onClick={copySummary} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                  Copy
                </button>
                <button onClick={clearSummary} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium">
                  <i className="ri-delete-bin-line" />
                  Clear
                </button>
              </div>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto scrollbar-thin">
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {summary.split('\n').map((line, i) => {
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={i} className="font-bold mb-1">{line.replace(/\*\*/g, '')}</p>
                  }
                  if (line.startsWith('• **')) {
                    const parts = line.replace('• **', '').split('**')
                    return (
                      <p key={i} className="ml-2 mb-1">
                        • <span className="font-semibold">{parts[0]}</span>{parts[1]}
                      </p>
                    )
                  }
                  return <p key={i} className="mb-1">{line}</p>
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
