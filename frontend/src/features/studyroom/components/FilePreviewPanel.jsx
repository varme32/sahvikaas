import { getFileUrl } from '../../../lib/api'

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
  const url = getFileUrl(resource.fileUrl)
  const name = (resource.name || '').toLowerCase()
  const type = (resource.type || '').toUpperCase()

  if (type === 'IMAGE' || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)) {
    return { type: 'image', url }
  }
  if (type === 'VIDEO' || /\.(mp4|webm|ogg)$/i.test(name)) {
    return { type: 'video', url }
  }
  if (type === 'PDF' || name.endsWith('.pdf')) {
    return { type: 'iframe', url }
  }
  if (type === 'DOC' || type === 'PPT' || /\.(doc|docx|ppt|pptx|xls|xlsx|txt)$/i.test(name)) {
    if (url.startsWith('http') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
      return { type: 'iframe', url: `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true` }
    }
    return null
  }
  return null
}

export default function FilePreviewPanel({ previewFile, onClose }) {
  if (!previewFile) return null

  const preview = getPreviewUrl(previewFile)
  const typeInfo = getTypeInfo(previewFile.type)

  return (
    <div className="flex flex-col h-full bg-white border-t border-gray-200">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${typeInfo.color}`}>
            <i className={`${typeInfo.icon} text-sm`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{previewFile.name}</p>
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
      <div className="flex-1 overflow-hidden">
        {preview?.type === 'image' && (
          <div className="h-full flex items-center justify-center p-3 bg-gray-50">
            <img
              src={preview.url}
              alt={previewFile.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
            />
          </div>
        )}
        {preview?.type === 'video' && (
          <div className="h-full flex items-center justify-center p-3 bg-black">
            <video src={preview.url} controls className="max-w-full max-h-full rounded-lg" />
          </div>
        )}
        {preview?.type === 'iframe' && (
          <iframe
            src={preview.url}
            className="w-full h-full border-none"
            title={previewFile.name}
          />
        )}
        {!preview && (
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
