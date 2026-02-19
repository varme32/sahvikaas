import { useState, useRef } from 'react'
import Modal from '../../../components/ui/Modal'

export default function ResourcesPanel() {
  const [folders, setFolders] = useState([])
  const [files, setFiles] = useState([])
  const [currentFolder, setCurrentFolder] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [uploadForm, setUploadForm] = useState({ title: '', description: '', file: null })

  const fileIcons = {
    pdf: { icon: 'ri-file-pdf-2-line', color: 'text-red-500' },
    image: { icon: 'ri-image-line', color: 'text-blue-500' },
    video: { icon: 'ri-video-line', color: 'text-purple-500' },
    audio: { icon: 'ri-music-line', color: 'text-green-500' },
    text: { icon: 'ri-file-text-line', color: 'text-gray-500' },
    default: { icon: 'ri-file-line', color: 'text-gray-400' },
  }

  const getIcon = (type) => fileIcons[type] || fileIcons.default

  const currentFiles = files.filter(f => f.folderId === currentFolder)

  const createFolder = () => {
    if (!newFolderName.trim()) return
    setFolders(prev => [...prev, { id: 'f' + Date.now(), name: newFolderName.trim(), items: 0 }])
    setNewFolderName('')
    setShowFolderModal(false)
  }

  const handleUpload = () => {
    if (!uploadForm.title || !uploadForm.file) return
    const ext = uploadForm.file.name.split('.').pop().toLowerCase()
    const typeMap = { pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', mp4: 'video', mp3: 'audio', txt: 'text' }
    setFiles(prev => [...prev, {
      id: 'file' + Date.now(),
      name: uploadForm.title,
      type: typeMap[ext] || 'default',
      size: (uploadForm.file.size / 1024).toFixed(0) + ' KB',
      folderId: currentFolder,
    }])
    setUploadForm({ title: '', description: '', file: null })
    setShowUploadModal(false)
  }

  if (previewFile) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-gray-100">
          <button
            onClick={() => setPreviewFile(null)}
            className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
          >
            <i className="ri-arrow-left-s-line" />
            Back to Files
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-gray-400">
            <i className={`${getIcon(previewFile.type).icon} text-5xl ${getIcon(previewFile.type).color}`} />
            <p className="text-sm font-medium text-gray-700 mt-3">{previewFile.name}</p>
            <p className="text-xs text-gray-400 mt-1">{previewFile.size}</p>
            <p className="text-xs text-gray-400 mt-3">Preview not available in demo</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700">Study Resources</h4>
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <i className="ri-upload-2-line" />
          Upload
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {/* Breadcrumb */}
        <div className="text-xs text-gray-500">
          <button onClick={() => setCurrentFolder(null)} className="hover:text-indigo-600">Home</button>
          {currentFolder && (
            <>
              <span className="mx-1">/</span>
              <span className="text-gray-700">{folders.find(f => f.id === currentFolder)?.name}</span>
            </>
          )}
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
          {currentFolder && (
            <button
              onClick={() => setCurrentFolder(null)}
              className="px-2 py-1 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
            >
              <i className="ri-arrow-left-line mr-1" />
              Back
            </button>
          )}
        </div>

        {/* Folders */}
        {!currentFolder && folders.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase">Folders</p>
            <div className="space-y-1.5">
              {folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => setCurrentFolder(folder.id)}
                  className="w-full flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <i className="ri-folder-fill text-lg text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{folder.name}</p>
                    <p className="text-xs text-gray-400">{folder.items} items</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        {currentFiles.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase">Files</p>
            <div className="space-y-1.5">
              {currentFiles.map(file => (
                <button
                  key={file.id}
                  onClick={() => setPreviewFile(file)}
                  className="w-full flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-left transition-colors"
                >
                  <i className={`${getIcon(file.type).icon} text-lg ${getIcon(file.type).color}`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400">{file.size}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {currentFiles.length === 0 && (currentFolder || folders.length === 0) && (
          <div className="text-center py-8 text-gray-400">
            <i className="ri-folder-open-line text-3xl" />
            <p className="text-sm mt-2">No resources yet</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)}>
        <div className="p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Upload Resource</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Title"
              value={uploadForm.title}
              onChange={e => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={uploadForm.description}
              onChange={e => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
            />
            <input
              type="file"
              accept=".pdf,.txt,.doc,.jpg,.png,.gif,.mp4,.mp3,.zip"
              onChange={e => setUploadForm(prev => ({ ...prev, file: e.target.files[0] }))}
              className="w-full text-sm text-gray-600"
            />
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowUploadModal(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleUpload} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Upload
            </button>
          </div>
        </div>
      </Modal>

      {/* New Folder Modal */}
      <Modal isOpen={showFolderModal} onClose={() => setShowFolderModal(false)}>
        <div className="p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">New Folder</h3>
          <input
            type="text"
            placeholder="Folder name"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createFolder()}
            className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
          />
          <div className="flex gap-2 mt-4 justify-end">
            <button onClick={() => setShowFolderModal(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={createFolder} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Create
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
