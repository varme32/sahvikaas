import { useState } from 'react'

export default function NotesPanel() {
  const [notes, setNotes] = useState([])

  const addNote = () => {
    setNotes(prev => [...prev, { id: Date.now(), title: '', content: '' }])
  }

  const updateNote = (id, field, value) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, [field]: value } : n))
  }

  const deleteNote = (id) => {
    if (confirm('Delete this note?')) {
      setNotes(prev => prev.filter(n => n.id !== id))
    }
  }

  const exportNote = (note) => {
    const blob = new Blob([`${note.title}\n\n${note.content}`], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${note.title || 'note'}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <h4 className="text-sm font-semibold text-gray-700">Shared Notes</h4>
        <button onClick={addNote} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
          + New Note
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {notes.map(note => (
          <div key={note.id} className="border border-gray-200 rounded-lg p-3">
            <input
              type="text"
              placeholder="Note title..."
              value={note.title}
              onChange={e => updateNote(note.id, 'title', e.target.value)}
              className="w-full text-sm font-medium text-gray-900 bg-transparent focus:outline-none mb-2 placeholder:text-gray-400"
            />
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => {/* save handled inline */}}
                className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                title="Save"
              >
                <i className="ri-save-line text-sm" />
              </button>
              <button
                onClick={() => exportNote(note)}
                className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                title="Export"
              >
                <i className="ri-download-2-line text-sm" />
              </button>
              <button
                onClick={() => deleteNote(note.id)}
                className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                title="Delete"
              >
                <i className="ri-delete-bin-line text-sm" />
              </button>
            </div>
            <textarea
              placeholder="Write your notes here..."
              value={note.content}
              onChange={e => updateNote(note.id, 'content', e.target.value)}
              className="w-full h-[150px] text-sm text-gray-700 bg-transparent border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        ))}
        {notes.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <i className="ri-sticky-note-line text-3xl" />
            <p className="text-sm mt-2">No notes yet. Click "+ New Note" to start.</p>
          </div>
        )}
      </div>
    </div>
  )
}
