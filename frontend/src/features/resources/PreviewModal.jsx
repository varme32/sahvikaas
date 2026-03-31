import { useState, useEffect } from 'react'

export default function PreviewModal({ resource, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [textContent, setTextContent] = useState('')
  const [blobUrl, setBlobUrl] = useState(null)

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'
  const proxyUrl = `${API_BASE}/api/resources/proxy?url=${encodeURIComponent(resource.fileUrl)}`

  // Determine file type from resource type AND title extension
  const titleLower = (resource.title || '').toLowerCase()
  const isPdf = resource.type === 'PDF' || titleLower.endsWith('.pdf')
  const isTxt = resource.type === 'TXT' || titleLower.endsWith('.txt')
    || resource.type === 'CODE' || titleLower.endsWith('.js') || titleLower.endsWith('.py')
    || titleLower.endsWith('.html') || titleLower.endsWith('.css') || titleLower.endsWith('.json')
    || titleLower.endsWith('.md') || titleLower.endsWith('.csv')
  const isDoc = resource.type === 'DOC' || /\.(doc|docx|ppt|pptx|xls|xlsx)$/i.test(titleLower)
  const isImage = resource.type === 'IMAGE' || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(titleLower)
  const isVideo = resource.type === 'VIDEO' || /\.(mp4|webm|ogg)$/i.test(titleLower)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setTextContent('')
    setBlobUrl(null)

    // For text files, fetch and display content
    if (isTxt) {
      fetch(proxyUrl)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to load file: ${res.status}`)
          return res.text()
        })
        .then(text => {
          setTextContent(text)
          setLoading(false)
        })
        .catch(err => {
          console.error('Error loading text:', err)
          setError(`Failed to load text file: ${err.message}`)
          setLoading(false)
        })
    }
    // For PDFs, fetch as blob → create object URL with correct MIME type
    // This is the key fix: we explicitly set the blob type to application/pdf
    // so the browser's built-in PDF viewer kicks in
    else if (isPdf) {
      fetch(proxyUrl)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to load PDF: ${res.status}`)
          return res.arrayBuffer()
        })
        .then(arrayBuffer => {
          // Create a blob with explicit PDF MIME type
          // This ensures the browser treats it as a PDF regardless of
          // what Content-Type the server returned
          const blob = new Blob([arrayBuffer], { type: 'application/pdf' })
          const url = URL.createObjectURL(blob)
          setBlobUrl(url)
          setLoading(false)
        })
        .catch(err => {
          console.error('Error loading PDF:', err)
          setError(`Failed to load PDF: ${err.message}`)
          setLoading(false)
        })
    }
    // For images and videos, the proxy URL works directly (inline header)
    // For docs, we rely on Google Docs Viewer
    else if (!isImage && !isVideo && !isDoc) {
      // Unknown type - just mark as loaded, iframe will handle it
      setLoading(false)
    }
  }, [resource.fileUrl])

  // Cleanup object URL when component unmounts or URL changes
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl)
      }
    }
  }, [blobUrl])

  const handleIframeLoad = () => {
    setLoading(false)
  }

  const handleIframeError = () => {
    setLoading(false)
    setError('Failed to load preview')
  }

  // For Office docs, use Google Docs viewer with the DIRECT Cloudinary URL
  // (Google fetches from Cloudinary server-side so Content-Disposition doesn't matter)
  const docViewerUrl = isDoc && resource.fileUrl
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(resource.fileUrl)}&embedded=true`
    : null

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl w-full h-full max-w-6xl max-h-[90vh] shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex items-center justify-between shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{resource.title}</h3>
            <p className="text-sm text-gray-500">{resource.type} • {resource.size}</p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <a
              href={resource.fileUrl}
              download={resource.title}
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <i className="ri-download-line" />
              Download
            </a>
            <a
              href={resource.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <i className="ri-external-link-line" />
              New Tab
            </a>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <i className="ri-close-line text-xl text-gray-500" />
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 relative overflow-hidden bg-gray-50">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-[#F2CF7E] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-600">Loading preview...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
              <div className="text-center">
                <i className="ri-file-damage-line text-5xl text-gray-300 mb-4" />
                <p className="text-gray-600 mb-4">{error}</p>
                <div className="flex gap-3 justify-center">
                  <a
                    href={resource.fileUrl}
                    download={resource.title}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#F2CF7E] text-black text-sm font-medium rounded-lg hover:bg-[#e0bd6c] transition-colors"
                  >
                    <i className="ri-download-line" />
                    Download File
                  </a>
                  <a
                    href={resource.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <i className="ri-external-link-line" />
                    Open in New Tab
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Text file preview */}
          {isTxt && textContent && (
            <div className="w-full h-full overflow-auto p-6">
              <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap break-words">
                {textContent}
              </pre>
            </div>
          )}

          {/* PDF preview using blob object URL with explicit application/pdf type */}
          {isPdf && blobUrl && (
            <iframe
              src={blobUrl}
              className="w-full h-full border-0"
              title={resource.title}
            />
          )}

          {/* Office docs preview via Google Docs Viewer */}
          {isDoc && (
            <iframe
              src={docViewerUrl}
              className="w-full h-full border-0"
              title={resource.title}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          )}

          {/* Image preview */}
          {isImage && (
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={proxyUrl}
                alt={resource.title}
                className="max-w-full max-h-full object-contain"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
              />
            </div>
          )}

          {/* Video preview */}
          {isVideo && (
            <div className="w-full h-full flex items-center justify-center p-4 bg-black">
              <video
                src={proxyUrl}
                controls
                className="max-w-full max-h-full"
                onLoadedData={handleIframeLoad}
                onError={handleIframeError}
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {/* Fallback for other file types */}
          {!isPdf && !isTxt && !isDoc && !isImage && !isVideo && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <i className="ri-file-line text-5xl text-gray-300 mb-4" />
                <p className="text-gray-600 mb-2">Preview not available for this file type</p>
                <div className="flex gap-3 justify-center mt-4">
                  <a
                    href={resource.fileUrl}
                    download={resource.title}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#F2CF7E] text-black text-sm font-medium rounded-lg hover:bg-[#e0bd6c] transition-colors"
                  >
                    <i className="ri-download-line" />
                    Download File
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
