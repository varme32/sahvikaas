import { useState, useEffect } from 'react'
import { useAuth } from '../../lib/auth'
import { getToken } from '../../lib/api'

// ─── API Functions ───
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000'

async function apiRequest(endpoint, options = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  })
  return res.json()
}

const resourceApi = {
  getLibrary: (params) => {
    const query = new URLSearchParams(params).toString()
    return apiRequest(`/api/resources/user/library?${query}`)
  },
  createResource: (data) => apiRequest('/api/resources/user/library', { method: 'POST', body: JSON.stringify(data) }),
  updateResource: (id, data) => apiRequest(`/api/resources/user/library/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteResource: (id) => apiRequest(`/api/resources/user/library/${id}`, { method: 'DELETE' }),
  moveResources: (resourceIds, folderId) => apiRequest('/api/resources/user/library/move', { method: 'POST', body: JSON.stringify({ resourceIds, folderId }) }),
  
  getFolders: (parentId) => {
    const query = parentId ? `?parentId=${parentId}` : ''
    return apiRequest(`/api/resources/user/folders${query}`)
  },
  createFolder: (data) => apiRequest('/api/resources/user/folders', { method: 'POST', body: JSON.stringify(data) }),
  updateFolder: (id, data) => apiRequest(`/api/resources/user/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFolder: (id) => apiRequest(`/api/resources/user/folders/${id}`, { method: 'DELETE' }),
}

// ─── Constants ───
const VIEW_MODES = {
  GRID: 'grid',
  LIST: 'list',
  COMPACT: 'compact',
}

const RESOURCE_TYPES = [
  { value: 'PDF', icon: 'ri-file-pdf-2-line', color: 'text-red-500 bg-red-50' },
  { value: 'DOC', icon: 'ri-file-word-2-line', color: 'text-blue-500 bg-blue-50' },
  { value: 'PPT', icon: 'ri-slideshow-3-line', color: 'text-orange-500 bg-orange-50' },
  { value: 'VIDEO', icon: 'ri-video-line', color: 'text-purple-500 bg-purple-50' },
  { value: 'LINK', icon: 'ri-link', color: 'text-green-500 bg-green-50' },
  { value: 'IMAGE', icon: 'ri-image-line', color: 'text-pink-500 bg-pink-50' },
  { value: 'CODE', icon: 'ri-code-line', color: 'text-gray-700 bg-gray-100' },
  { value: 'OTHER', icon: 'ri-file-line', color: 'text-gray-500 bg-gray-50' },
]

const FOLDER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
  '#eab308', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
]

// ─── Create/Edit Resource Modal ───
function ResourceModal({ resource, folderId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: resource?.title || '',
    type: resource?.type || 'PDF',
    tags: resource?.tags?.join(', ') || '',
  })
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)

  const selectedType = RESOURCE_TYPES.find(t => t.value === formData.type) || RESOURCE_TYPES[0]

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      if (!formData.title) {
        setFormData({ ...formData, title: selectedFile.name })
      }
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      setFile(droppedFile)
      if (!formData.title) {
        setFormData({ ...formData, title: droppedFile.name })
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!resource && !file) {
      alert('Please select a file to upload')
      return
    }

    setLoading(true)
    try {
      let fileUrl = resource?.fileUrl || ''
      let size = resource?.size || ''

      // If new file, upload it
      if (file) {
        const token = getToken()
        if (!token) {
          throw new Error('Not logged in. Please login first.')
        }

        const uploadFormData = new FormData()
        uploadFormData.append('file', file)
        
        const uploadRes = await fetch(`${API_BASE}/api/resources/upload`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`
          },
          body: uploadFormData,
        })
        
        if (!uploadRes.ok) {
          const errorText = await uploadRes.text()
          console.error('Upload error:', uploadRes.status, errorText)
          throw new Error(`Upload failed: ${uploadRes.status} ${uploadRes.statusText}`)
        }

        const uploadData = await uploadRes.json()
        if (uploadData.ok) {
          fileUrl = uploadData.fileUrl
          size = uploadData.size
        } else {
          throw new Error(uploadData.error || 'Upload failed')
        }
      }

      const data = {
        title: formData.title,
        type: formData.type,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        fileUrl,
        size,
        icon: selectedType.icon,
        iconColor: selectedType.color,
        folderId: folderId || null,
      }
      
      if (resource) {
        await resourceApi.updateResource(resource._id, data)
      } else {
        await resourceApi.createResource(data)
      }
      onSave()
    } catch (err) {
      console.error('Save error:', err)
      alert('Failed to save resource: ' + err.message)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 p-5 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{resource ? 'Edit Resource' : 'Upload Resource'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <i className="ri-close-line text-gray-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!resource && (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                dragOver ? 'border-[#F2CF7E] bg-[#F2CF7E]/10' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input').click()}
            >
              <input
                id="file-input"
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.mp4,.jpg,.jpeg,.png,.zip"
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#F2CF7E]/10 flex items-center justify-center">
                    <i className="ri-file-line text-2xl text-black" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
              ) : (
                <>
                  <i className="ri-upload-cloud-2-line text-4xl text-gray-400" />
                  <p className="text-sm text-gray-600 mt-3">
                    <span className="text-black font-medium">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PDF, DOC, PPT, VIDEO, IMAGE (max 50MB)</p>
                </>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              placeholder="Resource name"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Type</label>
            <select
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E] bg-white"
            >
              {RESOURCE_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.value}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Tags (optional)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={e => setFormData({ ...formData, tags: e.target.value })}
              placeholder="e.g. important, exam, chapter-5"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E]"
            />
            <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#F2CF7E] text-black text-sm font-medium rounded-lg hover:bg-[#e0bd6c] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <i className="ri-upload-2-line" />
                  {resource ? 'Update' : 'Upload'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Create/Edit Folder Modal ───
function FolderModal({ folder, parentId, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: folder?.name || '',
    color: folder?.color || FOLDER_COLORS[0],
    icon: folder?.icon || 'ri-folder-line',
    description: folder?.description || '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (folder) {
        await resourceApi.updateFolder(folder._id, formData)
      } else {
        await resourceApi.createFolder({ ...formData, parentId: parentId || null })
      }
      onSave()
    } catch (err) {
      alert('Failed to save folder')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="border-b border-gray-200 p-5 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{folder ? 'Edit Folder' : 'New Folder'}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center">
            <i className="ri-close-line text-gray-500" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Folder Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Semester 5"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E]"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-lg transition-all ${formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E] resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-[#F2CF7E] text-black text-sm font-medium rounded-lg hover:bg-[#e0bd6c] disabled:opacity-50"
            >
              {loading ? 'Saving...' : folder ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Resource Card Components ───
function ResourceGridCard({ resource, onEdit, onDelete, onToggleFavorite, onOpen }) {
  const typeInfo = RESOURCE_TYPES.find(t => t.value === resource.type) || RESOURCE_TYPES[0]
  
  return (
    <div className="group bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${resource.iconColor || typeInfo.color}`}>
            <i className={`${resource.icon || typeInfo.icon} text-xl`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-sm truncate group-hover:text-black transition-colors">
              {resource.title}
            </h3>
            {resource.subject && <p className="text-xs text-gray-500 mt-0.5">{resource.subject}</p>}
          </div>
          <button
            onClick={() => onToggleFavorite(resource)}
            className="shrink-0 w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center"
          >
            <i className={`${resource.isFavorite ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-gray-400'}`} />
          </button>
        </div>

        {resource.tags && resource.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {resource.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-[#F2CF7E]/10 text-black rounded-full">
                {tag}
              </span>
            ))}
            {resource.tags.length > 3 && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                +{resource.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {resource.notes && (
          <p className="text-xs text-gray-500 mt-2 line-clamp-2">{resource.notes}</p>
        )}

        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
          <span>{resource.type}</span>
          {resource.size && <span>• {resource.size}</span>}
          <span className="ml-auto">{new Date(resource.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      <div className="flex border-t border-gray-100">
        <button
          onClick={() => onOpen(resource)}
          className="flex-1 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <i className="ri-external-link-line" />
          Open
        </button>
        <div className="w-px bg-gray-100" />
        <button
          onClick={() => onEdit(resource)}
          className="flex-1 py-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <i className="ri-edit-line" />
          Edit
        </button>
        <div className="w-px bg-gray-100" />
        <button
          onClick={() => onDelete(resource)}
          className="flex-1 py-2.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
        >
          <i className="ri-delete-bin-line" />
          Delete
        </button>
      </div>
    </div>
  )
}

function ResourceListItem({ resource, onEdit, onDelete, onToggleFavorite, onOpen }) {
  const typeInfo = RESOURCE_TYPES.find(t => t.value === resource.type) || RESOURCE_TYPES[0]
  
  return (
    <div className="group bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${resource.iconColor || typeInfo.color}`}>
        <i className={`${resource.icon || typeInfo.icon} text-lg`} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 text-sm truncate">{resource.title}</h3>
          {resource.isFavorite && <i className="ri-star-fill text-yellow-400 text-xs" />}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          {resource.subject && <span>{resource.subject}</span>}
          <span>• {resource.type}</span>
          {resource.size && <span>• {resource.size}</span>}
          <span>• {new Date(resource.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
        {resource.tags && resource.tags.length > 0 && (
          <div className="flex gap-1 mt-2">
            {resource.tags.slice(0, 5).map((tag, i) => (
              <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onToggleFavorite(resource)}
          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
          title="Toggle favorite"
        >
          <i className={`${resource.isFavorite ? 'ri-star-fill text-yellow-400' : 'ri-star-line text-gray-400'}`} />
        </button>
        <button
          onClick={() => onOpen(resource)}
          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
          title="Open"
        >
          <i className="ri-external-link-line text-gray-600" />
        </button>
        <button
          onClick={() => onEdit(resource)}
          className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"
          title="Edit"
        >
          <i className="ri-edit-line text-gray-600" />
        </button>
        <button
          onClick={() => onDelete(resource)}
          className="w-8 h-8 rounded-lg hover:bg-red-50 flex items-center justify-center"
          title="Delete"
        >
          <i className="ri-delete-bin-line text-red-600" />
        </button>
      </div>
    </div>
  )
}

function FolderCard({ folder, onOpen, onEdit, onDelete, resourceCount }) {
  return (
    <div
      onClick={() => onOpen(folder)}
      className="group bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 p-4 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div
          className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${folder.color}20`, color: folder.color }}
        >
          <i className={`${folder.icon} text-xl`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 text-sm truncate group-hover:text-black transition-colors">
            {folder.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">{resourceCount} items</p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(folder) }}
            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center"
          >
            <i className="ri-edit-line text-gray-600 text-sm" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(folder) }}
            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center"
          >
            <i className="ri-delete-bin-line text-red-600 text-sm" />
          </button>
        </div>
      </div>
      {folder.description && (
        <p className="text-xs text-gray-500 mt-2 line-clamp-2">{folder.description}</p>
      )}
    </div>
  )
}

// ─── Main Component ───
export default function ResourcesPage() {
  const { user } = useAuth()
  const [viewMode, setViewMode] = useState(VIEW_MODES.GRID)
  const [currentFolderId, setCurrentFolderId] = useState(null)
  const [folderPath, setFolderPath] = useState([])
  const [folders, setFolders] = useState([])
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterFavorites, setFilterFavorites] = useState(false)
  const [selectedTag, setSelectedTag] = useState(null)
  
  const [showResourceModal, setShowResourceModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [editingResource, setEditingResource] = useState(null)
  const [editingFolder, setEditingFolder] = useState(null)

  // Load data
  const loadData = async () => {
    if (!user) {
      setLoading(false)
      return
    }
    
    setLoading(true)
    try {
      const params = { folderId: currentFolderId || 'null' }
      if (search) params.search = search
      if (filterFavorites) params.isFavorite = 'true'
      if (selectedTag) params.tags = selectedTag

      const [foldersRes, resourcesRes] = await Promise.all([
        resourceApi.getFolders(currentFolderId || 'null'),
        resourceApi.getLibrary(params),
      ])

      if (foldersRes.ok) setFolders(foldersRes.folders || [])
      if (resourcesRes.ok) setResources(resourcesRes.resources || [])
    } catch (err) {
      console.error('Failed to load data:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [currentFolderId, search, filterFavorites, selectedTag, user])

  // Get all unique tags
  const allTags = [...new Set(resources.flatMap(r => r.tags || []))]

  // Handlers
  const handleOpenFolder = (folder) => {
    setCurrentFolderId(folder._id)
    setFolderPath([...folderPath, { id: folder._id, name: folder.name }])
  }

  const handleNavigateToFolder = (index) => {
    if (index === -1) {
      setCurrentFolderId(null)
      setFolderPath([])
    } else {
      const folder = folderPath[index]
      setCurrentFolderId(folder.id)
      setFolderPath(folderPath.slice(0, index + 1))
    }
  }

  const handleCreateResource = () => {
    setEditingResource(null)
    setShowResourceModal(true)
  }

  const handleEditResource = (resource) => {
    setEditingResource(resource)
    setShowResourceModal(true)
  }

  const handleDeleteResource = async (resource) => {
    if (!confirm(`Delete "${resource.title}"?`)) return
    try {
      await resourceApi.deleteResource(resource._id)
      loadData()
    } catch (err) {
      alert('Failed to delete resource')
    }
  }

  const handleToggleFavorite = async (resource) => {
    try {
      await resourceApi.updateResource(resource._id, { isFavorite: !resource.isFavorite })
      loadData()
    } catch (err) {
      alert('Failed to update favorite')
    }
  }

  const handleOpenResource = (resource) => {
    if (!resource.fileUrl) {
      alert('No URL available for this resource')
      return
    }

    const fileUrl = resource.fileUrl
    const fileName = resource.title.toLowerCase()
    
    // Document formats that Google Docs Viewer can display
    const documentFormats = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt']
    const isDocument = documentFormats.some(ext => fileName.endsWith(ext))
    
    // Image formats
    const imageFormats = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
    const isImage = imageFormats.some(ext => fileName.endsWith(ext))
    
    // Video formats
    const videoFormats = ['.mp4', '.webm', '.ogg']
    const isVideo = videoFormats.some(ext => fileName.endsWith(ext))

    if (isDocument) {
      // Use Google Docs Viewer for all document formats
      const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`
      window.open(googleViewerUrl, '_blank')
    } 
    else if (isImage || isVideo) {
      // Open images and videos directly (Cloudinary serves these inline)
      window.open(fileUrl, '_blank')
    }
    else {
      // For other formats, try Google Docs Viewer anyway
      const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`
      window.open(googleViewerUrl, '_blank')
    }
  }

  const handleCreateFolder = () => {
    setEditingFolder(null)
    setShowFolderModal(true)
  }

  const handleEditFolder = (folder) => {
    setEditingFolder(folder)
    setShowFolderModal(true)
  }

  const handleDeleteFolder = async (folder) => {
    if (!confirm(`Delete folder "${folder.name}"? Resources will be moved to parent folder.`)) return
    try {
      await resourceApi.deleteFolder(folder._id)
      loadData()
    } catch (err) {
      alert('Failed to delete folder')
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <i className="ri-lock-line text-5xl text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Login Required</h2>
          <p className="text-gray-500 mb-4">Please log in to access your resources</p>
          <a
            href="/auth"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#F2CF7E] text-black text-sm font-medium rounded-lg hover:bg-[#e0bd6c] transition-colors"
          >
            <i className="ri-login-line" />
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#F2CF7E] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600">Loading resources...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Resources</h1>
          <p className="text-sm text-gray-500 mt-1">Organize and manage your study materials</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCreateFolder}
            className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <i className="ri-folder-add-line" />
            New Folder
          </button>
          <button
            onClick={handleCreateResource}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#F2CF7E] text-black text-sm font-medium rounded-lg hover:bg-[#e0bd6c] transition-colors"
          >
            <i className="ri-add-line" />
            Add Resource
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => handleNavigateToFolder(-1)}
          className="text-gray-600 hover:text-black transition-colors flex items-center gap-1"
        >
          <i className="ri-home-4-line" />
          Home
        </button>
        {folderPath.map((folder, index) => (
          <div key={folder.id} className="flex items-center gap-2">
            <i className="ri-arrow-right-s-line text-gray-400" />
            <button
              onClick={() => handleNavigateToFolder(index)}
              className="text-gray-600 hover:text-black transition-colors"
            >
              {folder.name}
            </button>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search resources..."
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#F2CF7E] focus:ring-1 focus:ring-[#F2CF7E]"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setFilterFavorites(!filterFavorites)}
            className={`h-10 px-4 rounded-lg border text-sm font-medium transition-colors flex items-center gap-2 ${
              filterFavorites ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <i className={filterFavorites ? 'ri-star-fill' : 'ri-star-line'} />
            Favorites
          </button>

          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode(VIEW_MODES.GRID)}
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                viewMode === VIEW_MODES.GRID ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              <i className="ri-grid-line" />
            </button>
            <button
              onClick={() => setViewMode(VIEW_MODES.LIST)}
              className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                viewMode === VIEW_MODES.LIST ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
              }`}
            >
              <i className="ri-list-check" />
            </button>
          </div>
        </div>
      </div>

      {/* Tags Filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <span className="text-xs text-gray-500 shrink-0">Tags:</span>
          <button
            onClick={() => setSelectedTag(null)}
            className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
              !selectedTag ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                selectedTag === tag ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F2CF7E]/10 flex items-center justify-center">
              <i className="ri-folder-line text-black" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Folders</p>
              <p className="text-lg font-semibold text-gray-900">{folders.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <i className="ri-file-line text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Resources</p>
              <p className="text-lg font-semibold text-gray-900">{resources.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center">
              <i className="ri-star-fill text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Favorites</p>
              <p className="text-lg font-semibold text-gray-900">{resources.filter(r => r.isFavorite).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <i className="ri-price-tag-3-line text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Tags</p>
              <p className="text-lg font-semibold text-gray-900">{allTags.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {folders.length === 0 && resources.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <i className="ri-folder-open-line text-5xl text-gray-300" />
          <p className="text-gray-500 mt-3 text-sm">
            {search || filterFavorites || selectedTag ? 'No resources found matching your filters' : 'No resources yet'}
          </p>
          <button
            onClick={handleCreateResource}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[#F2CF7E] text-black text-sm font-medium rounded-lg hover:bg-[#e0bd6c]"
          >
            <i className="ri-add-line" />
            Add Your First Resource
          </button>
        </div>
      ) : (
        <>
          {/* Folders */}
          {folders.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i className="ri-folder-line" />
                Folders
              </h3>
              <div className={viewMode === VIEW_MODES.GRID ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' : 'space-y-2'}>
                {folders.map(folder => (
                  <FolderCard
                    key={folder._id}
                    folder={folder}
                    onOpen={handleOpenFolder}
                    onEdit={handleEditFolder}
                    onDelete={handleDeleteFolder}
                    resourceCount={folder.resourceCount ?? 0}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Resources */}
          {resources.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <i className="ri-file-list-line" />
                Resources ({resources.length})
              </h3>
              {viewMode === VIEW_MODES.GRID ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {resources.map(resource => (
                    <ResourceGridCard
                      key={resource._id}
                      resource={resource}
                      onEdit={handleEditResource}
                      onDelete={handleDeleteResource}
                      onToggleFavorite={handleToggleFavorite}
                      onOpen={handleOpenResource}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {resources.map(resource => (
                    <ResourceListItem
                      key={resource._id}
                      resource={resource}
                      onEdit={handleEditResource}
                      onDelete={handleDeleteResource}
                      onToggleFavorite={handleToggleFavorite}
                      onOpen={handleOpenResource}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showResourceModal && (
        <ResourceModal
          resource={editingResource}
          folderId={currentFolderId}
          onClose={() => {
            setShowResourceModal(false)
            setEditingResource(null)
          }}
          onSave={() => {
            setShowResourceModal(false)
            setEditingResource(null)
            loadData()
          }}
        />
      )}

      {showFolderModal && (
        <FolderModal
          folder={editingFolder}
          parentId={currentFolderId}
          onClose={() => {
            setShowFolderModal(false)
            setEditingFolder(null)
          }}
          onSave={() => {
            setShowFolderModal(false)
            setEditingFolder(null)
            loadData()
          }}
        />
      )}
    </div>
  )
}

