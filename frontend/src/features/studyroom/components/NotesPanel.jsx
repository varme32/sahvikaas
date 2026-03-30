import { useState, useRef, useEffect } from 'react'
import { enhanceNotes } from '../../../lib/api'
import { getSocket } from '../../../lib/socket'

export default function NotesPanel({ roomId, notes, setNotes }) {
  const [activeNote, setActiveNote] = useState(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [enhanceType, setEnhanceType] = useState(null)
  const [showCreateNew, setShowCreateNew] = useState(false)
  const contentRef = useRef(null)
  const saveTimeoutRef = useRef(null)

  // Update active note when notes change from parent
  useEffect(() => {
    if (activeNote) {
      const updated = notes.find(n => n.id === activeNote.id)
      if (updated) {
        setActiveNote(updated)
      }
    }
  }, [notes])

  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.content.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const createNote = () => {
    if (!title.trim()) return
    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('note-create', {
        meetingId: roomId,
        note: { title: title.trim(), content: content.trim() },
      })
    }
    setShowCreateNew(false)
  }

  const updateNote = () => {
    if (!activeNote) return
    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('note-update', {
        meetingId: roomId,
        noteId: activeNote.id,
        title,
        content,
      })
    }
  }

  // Auto-save with debounce when editing
  const handleContentChange = (newContent) => {
    setContent(newContent)
    if (activeNote && roomId) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(() => {
        const socket = getSocket()
        if (socket?.connected) {
          socket.emit('note-update', {
            meetingId: roomId,
            noteId: activeNote.id,
            title,
            content: newContent,
          })
        }
      }, 1500) // Auto-save after 1.5s of no typing
    }
  }

  const deleteNote = (id) => {
    const socket = getSocket()
    if (socket?.connected && roomId) {
      socket.emit('note-delete', { meetingId: roomId, noteId: id })
    }
    if (activeNote?.id === id) {
      setActiveNote(null)
      setTitle('')
      setContent('')
    }
  }

  const openNote = (note) => {
    setActiveNote(note)
    setTitle(note.title)
    setContent(note.content)
    setShowCreateNew(false)
  }

  const handleNew = () => {
    setActiveNote(null)
    setTitle('')
    setContent('')
    setShowCreateNew(true)
  }

  const exportNote = () => {
    if (!content.trim()) return
    const blob = new Blob([`${title}\n${'='.repeat(title.length)}\n\n${content}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title || 'note'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAIEnhance = async (type) => {
    if (!content.trim() || isEnhancing) return
    setIsEnhancing(true)
    setEnhanceType(type)

    try {
      const data = await enhanceNotes(content, type)
      setContent(data.enhanced)
      if (activeNote) {
        // Sync AI-enhanceed content to the server
        const socket = getSocket()
        if (socket?.connected && roomId) {
          socket.emit('note-update', {
            meetingId: roomId,
            noteId: activeNote.id,
            content: data.enhanced,
          })
        }
      }
    } catch (err) {
      console.error('Enhance error:', err)
    } finally {
      setIsEnhancing(false)
      setEnhanceType(null)
    }
  }

  const formatDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Sidebar — note list */}
      <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col shrink-0 max-h-48 lg:max-h-none">
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <div className="relative flex-1">
            <i className="ri-search-line absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-7 pr-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <button onClick={handleNew} className="w-8 h-8 rounded-lg bg-[#F2CF7E] text-white flex items-center justify-center hover:bg-[#e0bd6c]" title="New note">
            <i className="ri-add-line" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredNotes.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-xs">
              {notes.length === 0 ? 'No notes yet. Create one!' : 'No matches found.'}
            </div>
          )}
          {filteredNotes.map(note => (
            <div
              key={note.id}
              onClick={() => openNote(note)}
              className={`px-3 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition ${activeNote?.id === note.id ? 'bg-[#F2CF7E]/10 border-l-2 border-l-indigo-500' : ''}`}
            >
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-medium text-gray-800 truncate flex-1">{note.title}</h5>
                <button
                  onClick={e => { e.stopPropagation(); deleteNote(note.id) }}
                  className="ml-1 w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50"
                >
                  <i className="ri-delete-bin-7-line text-[10px]" />
                </button>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">{note.content || 'Empty note'}</p>
              <p className="text-[9px] text-gray-300 mt-0.5">{note.createdBy ? `by ${note.createdBy} · ` : ''}{formatDate(note.updatedAt)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {!activeNote && !showCreateNew ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <i className="ri-file-text-line text-3xl" />
              <p className="text-sm mt-2">Select a note or create a new one</p>
              <button onClick={handleNew} className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-[#F2CF7E] text-white hover:bg-[#e0bd6c]">
                <i className="ri-add-line mr-1" /> New Note
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Title */}
            <div className="px-4 pt-3 pb-2 border-b border-gray-100 flex items-center gap-2 shrink-0">
              <input
                type="text"
                placeholder="Note title..."
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="flex-1 text-sm font-semibold text-gray-800 bg-transparent outline-none placeholder-gray-300"
              />
              <button
                onClick={activeNote ? updateNote : createNote}
                className="text-xs px-2.5 py-1 rounded-md bg-[#F2CF7E] text-white hover:bg-[#e0bd6c]"
              >
                {activeNote ? 'Save' : 'Create'}
              </button>
              <button
                onClick={exportNote}
                className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
                title="Export as .txt"
              >
                <i className="ri-download-line" />
              </button>
            </div>

            {/* AI Tools */}
            <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-1.5 shrink-0">
              <span className="text-[10px] text-gray-400 flex items-center mr-1">
                <i className="ri-sparkling-line mr-0.5" /> AI:
              </span>
              {[
                { type: 'summarize', icon: 'ri-file-reduce-line', label: 'Summarize' },
                { type: 'expand', icon: 'ri-file-add-line', label: 'Expand' },
                { type: 'format', icon: 'ri-list-ordered', label: 'Format' },
                { type: 'flashcards', icon: 'ri-stack-line', label: 'Flashcards' },
                { type: 'key-points', icon: 'ri-list-check-2', label: 'Key Points' },
                { type: 'simplify', icon: 'ri-lightbulb-line', label: 'Simplify' },
              ].map(btn => (
                <button
                  key={btn.type}
                  onClick={() => handleAIEnhance(btn.type)}
                  disabled={isEnhancing || !content.trim()}
                  className={`text-[10px] px-2 py-1 rounded-md border flex items-center gap-1 transition ${
                    isEnhancing && enhanceType === btn.type
                      ? 'border-indigo-300 bg-[#F2CF7E]/10 text-black'
                      : 'border-gray-200 text-gray-600 hover:bg-[#F2CF7E]/10 hover:border-[#F2CF7E]/30 hover:text-black'
                  } disabled:opacity-40`}
                >
                  <i className={`${btn.icon} ${isEnhancing && enhanceType === btn.type ? 'animate-spin' : ''}`} />
                  {isEnhancing && enhanceType === btn.type ? 'Working...' : btn.label}
                </button>
              ))}
            </div>

            {/* Content area */}
            <div className="flex-1 relative min-h-0">
              <textarea
                ref={contentRef}
                value={content}
                onChange={e => handleContentChange(e.target.value)}
                placeholder="Start writing your notes here...&#10;&#10;Tip: Use the AI tools above to summarize, expand, or turn your notes into flashcards.&#10;Notes are shared with all room participants in real-time."
                className="absolute inset-0 w-full h-full p-4 text-sm text-gray-700 bg-white resize-none outline-none placeholder-gray-300 leading-relaxed"
              />
              {isEnhancing && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F2CF7E]/10 text-black text-sm">
                    <i className="ri-loader-4-line animate-spin" />
                    AI is enhancing your notes...
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-1.5 border-t border-gray-100 text-[10px] text-gray-400 flex justify-between shrink-0">
              <span>{content.length} characters · {content.split(/\s+/).filter(Boolean).length} words</span>
              {activeNote && <span>Last saved: {formatDate(activeNote.updatedAt)}</span>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

