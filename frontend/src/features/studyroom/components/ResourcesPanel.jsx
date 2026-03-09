import { useState, useRef, useEffect } from 'react'
import Modal from '../../../components/ui/Modal'
import { getSocket } from '../../../lib/socket'
import { getToken } from '../../../lib/api'

const API_BASE = import.meta.env.VITE_API_URL || ''

const RESOURCE_TYPES = [
  { value: 'PDF', icon: 'ri-file-pdf-2-line', color: 'text-red-500 bg-red-50' },
  { value: 'DOC', icon: 'ri-file-word-2-line', color: 'text-blue-500 bg-blue-50' },
  { value: 'PPT', icon: 'ri-slideshow-3-line', color: 'text-orange-500 bg-orange-50' },
  { value: 'VIDEO', icon: 'ri-video-line', color: 'text-purple-500 bg-purple-50' },
  { value: 'IMAGE', icon: 'ri-image-line', color: 'text-pink-500 bg-pink-50' },
  { value: 'OTHER', icon: 'ri-file-line', color: 'text-gray-500 bg-gray-50' },
]

const FOLDER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
]

function getTypeFromExt(filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const map = { pdf: 'PDF', doc: 'DOC', docx: 'DOC', ppt: 'PPT', pptx: 'PPT', mp4: 'VIDEO', webm: 'VIDEO', jpg: 'IMAGE', jpeg: 'IMAGE', png: 'IMAGE', gif: 'IMAGE', webp: 'IMAGE' }
  return map[ext] || 'OTHER'
}

function getTypeInfo(type) {
  return RESOURCE_TYPES.find(t => t.value === type) || RESOURCE_TYPES[RESOURCE_TYPES.length - 1]
}

export default function ResourcesPanel({ roomId, resources: resourcesProp, folders: foldersProp }) {
  const [folders, setFolders] = useState(foldersProp || [])
  const [files, setFiles] = useState(resourcesProp || [])
  const [currentFolder, setCurrentFolder] = useState(null)
  const [folderPath, setFolderPath] = useState([])
  const [previewFile, setPreviewFile] = useState(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0])
  const [uploadForm, setUploadForm] = useState({ title: '', type: 'PDF', tags: '', file: null })
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('grid')
  const [dragOver, setDragOver] = useState(false)

  // Sync from parent props
  useEffect(() => {
    if (resourcesProp) setFiles(resourcesProp)
  }, [resourcesProp])
  useEffect(() => {
    if (foldersProp) setFolders(foldersProp)
  }, [foldersProp])

  const currentFiles = files
    .filter(f => f.folderId === currentFolder)
    .filter(f => !search || f.name?.toLowerCase().includes(search.toLowerCase()) || f.title?.toLowerCase().includes(search.toLowerCase()))

  const currentFolders = folders.filter(f => {
    if (currentFolder === null) return !f.parentId
    return f.parentId === currentFolder
  })

  const createFolder = () => {
    if (!newFolderName.trim()) return
    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('resource-folder-create', {
        meetingId: roomId,
        name: newFolderName.trim(),
        color: newFolderColor,
        parentId: currentFolder,
      })
    }
    setNewFolderName('')
    setNewFolderColor(FOLDER_COLORS[0])
    setShowFolderModal(false)
  }

  const handleUpload = async () => {
    if (!uploadForm.file) return
    setUploading(true)

    try {
      let fileUrl = ''
      let size = ''

      // Upload file to Cloudinary via backend
      const token = getToken()
      const formData = new FormData()
      formData.append('file', uploadForm.file)

      const uploadRes = await fetch(`${API_BASE}/api/resources/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json()
        if (uploadData.ok) {
          fileUrl = uploadData.fileUrl
          size = uploadData.size
        }
      }

      if (!fileUrl) {
        // Fallback: just track metadata without actual file storage
        size = (uploadForm.file.size / 1024).toFixed(0) + ' KB'
      }

      const type = uploadForm.type || getTypeFromExt(uploadForm.file.name)
      const typeInfo = getTypeInfo(type)

      const socket = getSocket()
      if (socket?.connected && roomId) {
        socket.emit('resource-add', {
          meetingId: roomId,
          resource: {
            name: uploadForm.title || uploadForm.file.name,
            type,
            size: size || (uploadForm.file.size / 1024).toFixed(0) + ' KB',
            folderId: currentFolder,
            fileUrl,
            icon: typeInfo.icon,
            iconColor: typeInfo.color,
            tags: uploadForm.tags.split(',').map(t => t.trim()).filter(Boolean),
          },
        })
      }
    } catch (err) {
      console.error('Upload error:', err)
      alert('Failed to upload: ' + err.message)
    }

    setUploadForm({ title: '', type: 'PDF', tags: '', file: null })
    setShowUploadModal(false)
    setUploading(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      setUploadForm(prev => ({
        ...prev,
        file: droppedFile,
        title: prev.title || droppedFile.name,
        type: getTypeFromExt(droppedFile.name),
      }))
      setShowUploadModal(true)
    }
  }

  const handleDeleteResource = (resourceId) => {
    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('resource-delete', { meetingId: roomId, resourceId })
    }
  }

  const handleOpenFolder = (folder) => {
    setCurrentFolder(folder.id)
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }])
  }

  const handleNavigateToFolder = (index) => {
    if (index === -1) {
      setCurrentFolder(null)
      setFolderPath([])
    } else {
      const folder = folderPath[index]
      setCurrentFolder(folder.id)
      setFolderPath(folderPath.slice(0, index + 1))
    }
  }

  const handleOpenResource = (resource) => {
    if (resource.fileUrl) {
      setPreviewFile(resource)
    } else {
      alert('No file URL available for preview')
    }
  }

  const getPreviewUrl = (resource) => {
    if (!resource?.fileUrl) return null
    const url = resource.fileUrl
    const name = (resource.name || '').toLowerCase()
    const type = (resource.type || '').toUpperCase()

    // Images: render directly
    if (type === 'IMAGE' || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(name)) {
      return { type: 'image', url }
    }
    // Videos: render in video element
    if (type === 'VIDEO' || /\.(mp4|webm|ogg)$/i.test(name)) {
      return { type: 'video', url }
    }
    // PDFs and documents: use Google Docs Viewer
    if (type === 'PDF' || type === 'DOC' || type === 'PPT' || /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|txt)$/i.test(name)) {
      return { type: 'iframe', url: `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true` }
    }
    // Fallback: try Google Docs Viewer
    return { type: 'iframe', url: `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true` }
  }

  // Preview mode
  if (previewFile) {
    const preview = getPreviewUrl(previewFile)
    const typeInfo = getTypeInfo(previewFile.type)

    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between shrink-0">
          <button
            onClick={() => setPreviewFile(null)}
            className="flex items-center gap-1 text-sm text-black hover:text-[#e0bd6c]"
          >
            <i className="ri-arrow-left-s-line" />
            Back to Files
          </button>
          {previewFile.fileUrl && (
            <a
              href={previewFile.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
            >
              <i className="ri-external-link-line" />
              Open in new tab
            </a>
          )}
        </div>
        <div className="px-3 py-2 border-b border-gray-50 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeInfo.color}`}>
              <i className={`${typeInfo.icon} text-base`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{previewFile.name}</p>
              <p className="text-xs text-gray-400">{previewFile.size} · {previewFile.type} · by {previewFile.uploadedBy}</p>
            </div>
          </div>
          {previewFile.tags && previewFile.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {previewFile.tags.map((tag, i) => (
                <span key={i} className="text-xs px-2 py-0.5 bg-[#F2CF7E]/10 text-black rounded-full">{tag}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-hidden">
          {preview?.type === 'image' && (
            <div className="h-full flex items-center justify-center p-4 bg-gray-50">
              <img src={preview.url} alt={previewFile.name} className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
            </div>
          )}
          {preview?.type === 'video' && (
            <div className="h-full flex items-center justify-center p-4 bg-black">
              <video src={preview.url} controls className="max-w-full max-h-full rounded-lg" />
            </div>
          )}
          {preview?.type === 'iframe' && (
            <iframe src={preview.url} className="w-full h-full border-none" title={previewFile.name} />
          )}
          {!preview && (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <i className={`${typeInfo.icon} text-5xl ${typeInfo.color.split(' ')[0]}`} />
                <p className="text-sm mt-3">Preview not available</p>
                {previewFile.fileUrl && (
                  <a href={previewFile.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                    Download file
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-full"
      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
        <h4 className="text-sm font-semibold text-gray-700">
          Study Resources
          <span className="ml-2 text-[10px] font-normal text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">Shared</span>
        </h4>
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5 bg-gray-100 rounded p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              <i className="ri-grid-line text-xs" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
            >
              <i className="ri-list-check text-xs" />
            </button>
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-[#F2CF7E] rounded-lg hover:bg-[#e0bd6c]"
          >
            <i className="ri-upload-2-line" />
            Upload
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 shrink-0">
        <div className="relative">
          <i className="ri-search-line absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search resources..."
            className="w-full h-8 pl-8 pr-3 rounded-md border border-gray-200 text-xs focus:outline-none focus:border-[#F2CF7E]"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 bg-blue-50/80 z-20 flex items-center justify-center border-2 border-dashed border-blue-400 rounded-lg">
            <div className="text-center">
              <i className="ri-upload-cloud-2-line text-4xl text-blue-500" />
              <p className="text-sm text-blue-700 font-medium mt-2">Drop file to upload</p>
            </div>
          </div>
        )}

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <button onClick={() => handleNavigateToFolder(-1)} className="hover:text-black flex items-center gap-0.5">
            <i className="ri-home-4-line" /> Home
          </button>
          {folderPath.map((folder, index) => (
            <div key={folder.id} className="flex items-center gap-1.5">
              <i className="ri-arrow-right-s-line text-gray-400" />
              <button onClick={() => handleNavigateToFolder(index)} className="hover:text-black">
                {folder.name}
              </button>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowFolderModal(true)}
            className="px-2 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            <i className="ri-folder-add-line mr-1" />
            New Folder
          </button>
        </div>

        {/* Folders */}
        {currentFolders.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase">Folders</p>
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-1.5'}>
              {currentFolders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => handleOpenFolder(folder)}
                  className="w-full flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${folder.color || '#6366f1'}20`, color: folder.color || '#6366f1' }}>
                    <i className="ri-folder-fill text-lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{folder.name}</p>
                    <p className="text-xs text-gray-400">by {folder.createdBy}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        {currentFiles.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase">Files ({currentFiles.length})</p>
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-2' : 'space-y-1.5'}>
              {currentFiles.map(file => {
                const typeInfo = getTypeInfo(file.type)
                return (
                  <div
                    key={file.id}
                    className="group border border-gray-200 rounded-lg hover:shadow-md transition-all overflow-hidden"
                  >
                    <button
                      onClick={() => handleOpenResource(file)}
                      className="w-full p-2.5 text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${file.iconColor || typeInfo.color}`}>
                          <i className={`${file.icon || typeInfo.icon} text-lg`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                            <span>{file.type}</span>
                            {file.size && <span>• {file.size}</span>}
                            <span>• {file.uploadedBy}</span>
                          </div>
                        </div>
                      </div>
                      {file.tags && file.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {file.tags.slice(0, 3).map((tag, i) => (
                            <span key={i} className="text-xs px-1.5 py-0.5 bg-[#F2CF7E]/10 text-black rounded-full">{tag}</span>
                          ))}
                        </div>
                      )}
                    </button>
                    <div className="flex border-t border-gray-100">
                      <button
                        onClick={() => handleOpenResource(file)}
                        className="flex-1 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1"
                      >
                        <i className="ri-eye-line" /> Preview
                      </button>
                      {file.fileUrl && (
                        <>
                          <div className="w-px bg-gray-100" />
                          <a
                            href={file.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1"
                          >
                            <i className="ri-external-link-line" /> Open
                          </a>
                        </>
                      )}
                      <div className="w-px bg-gray-100" />
                      <button
                        onClick={() => handleDeleteResource(file.id)}
                        className="flex-1 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center justify-center gap-1"
                      >
                        <i className="ri-delete-bin-line" /> Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {currentFiles.length === 0 && currentFolders.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <i className="ri-folder-open-line text-3xl" />
            <p className="text-sm mt-2">No resources yet</p>
            <p className="text-xs mt-1">Upload files or drag & drop to share</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)}>
        <div className="p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Upload Resource</h3>
          <div className="space-y-3">
            {/* Drag & Drop area */}
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                uploadForm.file ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => document.getElementById('resource-file-input').click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) {
                  setUploadForm(prev => ({ ...prev, file: f, title: prev.title || f.name, type: getTypeFromExt(f.name) }))
                }
              }}
            >
              <input
                id="resource-file-input"
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.jpg,.jpeg,.png,.gif,.zip"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) {
                    setUploadForm(prev => ({ ...prev, file: f, title: prev.title || f.name, type: getTypeFromExt(f.name) }))
                  }
                }}
              />
              {uploadForm.file ? (
                <div className="flex items-center justify-center gap-3">
                  <i className="ri-file-line text-2xl text-green-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{uploadForm.file.name}</p>
                    <p className="text-xs text-gray-500">{(uploadForm.file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              ) : (
                <>
                  <i className="ri-upload-cloud-2-line text-3xl text-gray-400" />
                  <p className="text-sm text-gray-600 mt-2"><span className="font-medium text-black">Click</span> or drag to upload</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOC, PPT, VIDEO, IMAGE (max 50MB)</p>
                </>
              )}
            </div>

            <input
              type="text"
              placeholder="Title"
              value={uploadForm.title}
              onChange={e => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E]"
            />

            <select
              value={uploadForm.type}
              onChange={e => setUploadForm(prev => ({ ...prev, type: e.target.value }))}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E] bg-white"
            >
              {RESOURCE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.value}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Tags (comma separated)"
              value={uploadForm.tags}
              onChange={e => setUploadForm(prev => ({ ...prev, tags: e.target.value }))}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E]"
            />
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowUploadModal(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!uploadForm.file || uploading}
              className="px-4 py-1.5 text-sm bg-[#F2CF7E] text-white rounded-lg hover:bg-[#e0bd6c] disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <i className="ri-upload-2-line" />
                  Upload
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* New Folder Modal */}
      <Modal isOpen={showFolderModal} onClose={() => setShowFolderModal(false)}>
        <div className="p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">New Folder</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createFolder()}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#F2CF7E]"
            />
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Color</label>
              <div className="flex flex-wrap gap-2">
                {FOLDER_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewFolderColor(color)}
                    className={`w-7 h-7 rounded-lg transition-all ${newFolderColor === color ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowFolderModal(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={createFolder} className="px-3 py-1.5 text-sm bg-[#F2CF7E] text-white rounded-lg hover:bg-[#e0bd6c]">
              Create
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

