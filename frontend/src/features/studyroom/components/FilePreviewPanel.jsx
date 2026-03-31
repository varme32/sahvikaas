import { useState, useEffect } from 'react'
import { getFileUrl, getPreviewProxyUrl } from '../../../lib/api'

const RESOURCE_TYPES = [
  { value: 'PDF', icon: 'ri-file-pdf-2-line', color: 'text-red-500 bg-red-50' },
  { value: 'DOC', icon: 'ri-file-word-2-line', color: 'text-blue-500 bg-blue-50' },
  { value: 'PPT', icon: 'ri-slideshow-3-line', color: 'text-orange-500 bg-orange-50' },
  { value: 'VIDEO', icon: 'ri-video-line', color: 'text-purple-500 bg-purple-50' },
  { value: 'IMAGE', icon: 'ri-image-line', color: 'text-pink-500 bg-pink-50' },
  { value: 'OTHER', icon: 'ri-file-line', color: 'text-gray-500 bg-gray-50' },
]

function getTypeInfo(type) {
  return RESOURCE_TYPES.find(t => t.value === type) || RESOURCE_TYPES[RESOURCE_TYPES.length - 1]
}

function getPreviewUrl(resource) {
  if (!resource?.fileUrl) return null
  const rawUrl = getFileUrl(resource.fileUrl)
  const proxyUrl = getPreviewProxyUrl(resource.fileUrl) || rawUrl
  const name = (resource.title || resource.name || '').toLowerCase()
  const type = (resource.type || '').toUpperCase()

  if (type === 'IMAGE' || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)) {
    return { type: 'image', url: rawUrl }
  }
  if (type === 'VIDEO' || /\.(mp4|webm|ogg)$/i.test(name)) {
    return { type: 'video', url: rawUrl }
  }
  // PDFs: fetch via proxy as blob for inline rendering
  if (type === 'PDF' || /\.pdf$/i.test(name)) {
    return { type: 'pdf', fetchUrl: proxyUrl }
  }
  // Text files: fetch via proxy and display as text
  if (/\.(txt|md|csv|js|py|html|css|json)$/i.test(name)) {
    return { type: 'text', fetchUrl: proxyUrl }
  }
  if (type === 'DOC' || type === 'PPT' || /\.(doc|docx|ppt|pptx|xls|xlsx)$/i.test(name)) {
    if (rawUrl) {
      const gdocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(rawUrl)}&embedded=true`
      return { type: 'iframe', url: gdocsUrl }
    }
    return null
  }
  // Unknown type with a fileUrl — try proxy as last resort
  if (rawUrl) {
    return proxyUrl ? { type: 'iframe', url: proxyUrl } : { type: 'iframe', url: rawUrl }
  }
  return null
}

export default function FilePreviewPanel({ previewFile, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null)
  const [textContent, setTextContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  if (!previewFile) return null

  const preview = getPreviewUrl(previewFile)
  const typeInfo = getTypeInfo(previewFile.type)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setBlobUrl(null)
    setTextContent('')

    if (preview?.type === 'pdf') {
      // Fetch PDF as blob with explicit MIME type so browser PDF viewer works
      fetch(preview.fetchUrl)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to load PDF: ${res.status}`)
          return res.arrayBuffer()
        })
        .then(buf => {
          const blob = new Blob([buf], { type: 'application/pdf' })
          setBlobUrl(URL.createObjectURL(blob))
          setLoading(false)
        })
        .catch(err => {
          console.error('PDF load error:', err)
          setError(err.message)
          setLoading(false)
        })
    } else if (preview?.type === 'text') {
      fetch(preview.fetchUrl)
        .then(res => {
          if (!res.ok) throw new Error(`Failed to load text: ${res.status}`)
          return res.text()
        })
        .then(text => {
          setTextContent(text)
          setLoading(false)
        })
        .catch(err => {
          console.error('Text load error:', err)
          setError(err.message)
          setLoading(false)
        })
    } else {
      setLoading(false)
    }

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [previewFile?.fileUrl])

  return (
    <div className="flex flex-col h-full bg-white border-t border-gray-200">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${typeInfo.color}`}>
            <i className={`${typeInfo.icon} text-sm`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{previewFile.name || previewFile.title}</p>
            <p className="text-[10px] text-gray-400 truncate">
              {previewFile.size && `${previewFile.size} · `}{previewFile.type}{previewFile.uploadedBy && ` · by ${previewFile.uploadedBy}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {previewFile.fileUrl && (
            <a
              href={getFileUrl(previewFile.fileUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors"
              title="Open in new tab"
            >
              <i className="ri-external-link-line text-sm" />
            </a>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors"
            title="Close preview"
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>
      </div>

      {/* Tags */}
      {previewFile.tags && previewFile.tags.length > 0 && (
        <div className="px-3 py-1.5 border-b border-gray-50 flex flex-wrap gap-1 shrink-0">
          {previewFile.tags.map((tag, i) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 bg-[#F2CF7E]/15 text-black rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Preview content */}
      <div className="flex-1 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-3 border-[#F2CF7E] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500">Loading preview...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center px-4">
              <i className="ri-file-damage-line text-4xl text-gray-300" />
              <p className="text-xs mt-2 text-gray-500">{error}</p>
              {previewFile.fileUrl && (
                <a href={getFileUrl(previewFile.fileUrl)} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
                  Download file
                </a>
              )}
            </div>
          </div>
        )}
        {preview?.type === 'image' && (
          <div className="h-full flex items-center justify-center p-3 bg-gray-50">
            <img
              src={preview.url}
              alt={previewFile.name || previewFile.title}
              className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
              onLoad={() => setLoading(false)}
            />
          </div>
        )}
        {preview?.type === 'video' && (
          <div className="h-full flex items-center justify-center p-3 bg-black">
            <video src={preview.url} controls className="max-w-full max-h-full rounded-lg" onLoadedData={() => setLoading(false)} />
          </div>
        )}
        {preview?.type === 'pdf' && blobUrl && (
          <iframe
            src={blobUrl}
            className="w-full h-full border-none"
            title={previewFile.name || previewFile.title}
          />
        )}
        {preview?.type === 'text' && textContent && (
          <div className="w-full h-full overflow-auto p-4">
            <pre className="text-xs text-gray-800 font-mono whitespace-pre-wrap break-words">{textContent}</pre>
          </div>
        )}
        {preview?.type === 'iframe' && (
          <iframe
            src={preview.url}
            className="w-full h-full border-none"
            title={previewFile.name || previewFile.title}
            onLoad={() => setLoading(false)}
          />
        )}
        {!preview && !loading && !error && (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center px-4">
              <i className={`${typeInfo.icon} text-4xl ${typeInfo.color.split(' ')[0]}`} />
              <p className="text-sm mt-2 font-medium">Preview not available</p>
              <p className="text-xs mt-1 text-gray-400">
                {previewFile.type === 'DOC' || previewFile.type === 'PPT'
                  ? 'DOC/PPT preview requires an external URL'
                  : 'This file type cannot be previewed'}
              </p>
              {previewFile.fileUrl && (
                <a
                  href={getFileUrl(previewFile.fileUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-2"
                >
                  <i className="ri-download-line" /> Download file
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
