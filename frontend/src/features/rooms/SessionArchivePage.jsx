import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getRoomSessionArchive } from '../../lib/roomApiV2'
import { useAuth } from '../../lib/auth'
import { getFileUrl } from '../../lib/api'

const archiveTabs = [
  { id: 'overview', label: 'Overview', icon: 'ri-layout-grid-line' },
  { id: 'chat', label: 'Chat', icon: 'ri-message-3-line' },
  { id: 'notes', label: 'Notes', icon: 'ri-sticky-note-line' },
  { id: 'tasks', label: 'Tasks', icon: 'ri-calendar-todo-line' },
  { id: 'resources', label: 'Resources', icon: 'ri-folder-line' },
  { id: 'quiz', label: 'Quiz', icon: 'ri-questionnaire-line' },
]

function formatDateTime(value) {
  if (!value) return 'Not available'
  return new Date(value).toLocaleString()
}

function formatDuration(minutes) {
  if (minutes == null) return 'Not available'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function EmptyArchiveState({ icon, title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center text-gray-500">
      <i className={`${icon} text-3xl`} />
      <p className="mt-3 text-sm font-medium text-gray-700">{title}</p>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  )
}

// Determine file icon from type/name
function getFileIcon(resource) {
  const name = (resource.name || '').toLowerCase()
  const type = (resource.type || '').toLowerCase()
  if (type.startsWith('image') || /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(name)) return 'ri-image-line'
  if (type === 'pdf' || name.endsWith('.pdf')) return 'ri-file-pdf-2-line'
  if (type.startsWith('video') || /\.(mp4|webm|mov|avi)$/i.test(name)) return 'ri-video-line'
  if (type.startsWith('audio') || /\.(mp3|wav|ogg)$/i.test(name)) return 'ri-music-line'
  if (/\.(doc|docx)$/i.test(name)) return 'ri-file-word-line'
  if (/\.(xls|xlsx|csv)$/i.test(name)) return 'ri-file-excel-line'
  if (/\.(ppt|pptx)$/i.test(name)) return 'ri-file-ppt-line'
  if (/\.(zip|rar|7z|tar|gz)$/i.test(name)) return 'ri-folder-zip-line'
  if (/\.(js|ts|py|java|cpp|c|html|css|json|xml|md)$/i.test(name)) return 'ri-code-s-slash-line'
  return resource.icon || 'ri-file-line'
}

// Check if resource is previewable
function isImageFile(resource) {
  const name = (resource.name || '').toLowerCase()
  const type = (resource.type || '').toLowerCase()
  return type.startsWith('image') || /\.(png|jpg|jpeg|gif|webp|svg|bmp)$/i.test(name)
}

function isPdfFile(resource) {
  const name = (resource.name || '').toLowerCase()
  const type = (resource.type || '').split('/').pop().toLowerCase()
  return type === 'pdf' || name.endsWith('.pdf')
}

function isVideoFile(resource) {
  const name = (resource.name || '').toLowerCase()
  const type = (resource.type || '').toLowerCase()
  return type.startsWith('video') || /\.(mp4|webm|mov)$/i.test(name)
}

function isDocFile(resource) {
  const name = (resource.name || '').toLowerCase()
  const type = (resource.type || '').toLowerCase()
  return type === 'doc' || type === 'docx' || type === 'ppt' || type === 'pptx' || /\.(doc|docx|ppt|pptx|xls|xlsx|txt)$/i.test(name)
}

// Resource preview component
function ResourcePreview({ resource }) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const url = getFileUrl(resource.fileUrl)

  if (!url) return null

  if (isImageFile(resource)) {
    return (
      <div className="mt-3">
        <img
          src={url}
          alt={resource.name}
          className="max-h-48 rounded-xl border border-gray-200 object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setPreviewOpen(true)}
          loading="lazy"
        />
        {previewOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
            onClick={() => setPreviewOpen(false)}
          >
            <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => setPreviewOpen(false)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center text-gray-600 hover:text-black z-10"
              >
                <i className="ri-close-line text-lg" />
              </button>
              <img src={url} alt={resource.name} className="max-h-[85vh] rounded-xl object-contain" />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (isPdfFile(resource)) {
    return (
      <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden bg-gray-100">
        <iframe
          src={`${url}#toolbar=1&navpanes=0`}
          title={resource.name}
          className="w-full h-64 border-0"
          loading="lazy"
        />
      </div>
    )
  }

  if (isVideoFile(resource)) {
    return (
      <div className="mt-3 rounded-xl overflow-hidden border border-gray-200">
        <video src={url} controls className="w-full max-h-64" preload="metadata" />
      </div>
    )
  }

  if (isDocFile(resource)) {
    const isLocal = url.includes('localhost') || url.includes('127.0.0.1')
    if (isLocal) return null // Google Docs Viewer won't work locally

    return (
      <div className="mt-3 rounded-xl border border-gray-200 overflow-hidden bg-gray-100">
        <iframe
          src={`https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`}
          title={resource.name}
          className="w-full h-96 border-0"
          loading="lazy"
        />
      </div>
    )
  }

  return null
}

export default function SessionArchivePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [archive, setArchive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('overview')
  const [expandedQuestions, setExpandedQuestions] = useState(false)

  useEffect(() => {
    let cancelled = false
    let retryTimer = null

    const loadArchive = async (attempt = 0) => {
      try {
        if (attempt === 0) {
          setLoading(true)
          setError('')
        }

        const data = await getRoomSessionArchive(id)
        if (cancelled) return

        setArchive(data.archive || data)
        setError('')
        setLoading(false)
      } catch (err) {
        if (cancelled) return

        const shouldRetry = attempt < 7 && /not found|expired/i.test(err.message || '')
        if (shouldRetry) {
          retryTimer = window.setTimeout(() => loadArchive(attempt + 1), 1200 * (attempt + 1))
          return
        }

        setError(err.message || 'Failed to load session archive')
        setLoading(false)
      }
    }

    loadArchive()

    return () => {
      cancelled = true
      if (retryTimer) window.clearTimeout(retryTimer)
    }
  }, [id])

  // Determine if current user is the host
  const currentUserName = user?.name || ''
  const isHost = archive
    ? (archive.createdByName === currentUserName ||
       archive.createdById === user?._id ||
       archive.createdById === user?.id)
    : false

  if (loading) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-10 shadow-sm">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-full border-4 border-[#F2CF7E] border-t-transparent animate-spin" />
          <p className="mt-4 text-base font-semibold text-gray-900">Loading session archive</p>
          <p className="mt-1 text-sm text-gray-500">Fetching the stored chat, notes, resources, and shared room data.</p>
        </div>
      </div>
    )
  }

  if (error || !archive) {
    return (
      <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
        <button
          onClick={() => navigate('/rooms')}
          className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <i className="ri-arrow-left-line" />
          Back to rooms
        </button>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
          <i className="ri-archive-stack-line text-4xl text-amber-600" />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">Session archive unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">
            {error || 'The stored session data is no longer available for this meeting.'}
          </p>
        </div>
      </div>
    )
  }

  const summary = archive.summary || {}
  const statCards = [
    { label: 'Duration', value: formatDuration(archive.duration), icon: 'ri-time-line' },
    { label: 'Messages', value: summary.chatCount ?? archive.chatMessages?.length ?? 0, icon: 'ri-message-3-line' },
    { label: 'Tasks', value: summary.taskCount ?? archive.tasks?.length ?? 0, icon: 'ri-calendar-todo-line' },
    { label: 'Resources', value: summary.resourceCount ?? archive.resources?.length ?? 0, icon: 'ri-folder-line' },
  ]

  const tabCounts = {
    chat: archive.chatMessages?.length || 0,
    notes: archive.sharedNotes?.length || 0,
    tasks: archive.tasks?.length || 0,
    resources: archive.resources?.length || 0,
    quiz: (archive.quizResults?.length || 0) + (archive.activeQuiz ? 1 : 0),
  }

  const quizQuestions = archive.activeQuiz?.questions || []
  const quizResults = archive.quizResults || []
  const sortedResults = [...quizResults].sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <button
              onClick={() => navigate('/rooms')}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <i className="ri-arrow-left-line" />
              Back to rooms
            </button>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#b48b2d]">Session Archive</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 sm:text-3xl">{archive.roomName}</h1>
            <p className="mt-2 text-sm text-gray-600">{archive.subject || 'General study session'}</p>
            {isHost && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#F8F2DE] px-3 py-1 text-xs font-semibold text-[#8a6a1e]">
                <i className="ri-shield-star-line" /> You hosted this session
              </span>
            )}
          </div>

          <div className="rounded-2xl border border-[#F2CF7E]/50 bg-[#F8F2DE] px-4 py-3 text-sm text-gray-700">
            <div className="flex items-center gap-2 font-semibold text-gray-900">
              <i className="ri-archive-line text-[#b48b2d]" />
              Available until {formatDateTime(archive.expiresAt)}
            </div>
            <p className="mt-1 text-xs text-gray-600">
              Stored for {summary.retentionDays || 7} days after the meeting ended.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Host</p>
            <p className="mt-2 text-sm font-semibold text-gray-900">{archive.createdByName || 'Unknown host'}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Started</p>
            <p className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(archive.startedAt)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ended</p>
            <p className="mt-2 text-sm font-semibold text-gray-900">{formatDateTime(archive.endedAt)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Participants</p>
            <p className="mt-2 text-sm font-semibold text-gray-900">{archive.participantNames?.length || archive.participants?.length || 0}</p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map(card => (
          <div key={card.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <i className={`${card.icon} text-lg text-[#b48b2d]`} />
            </div>
            <p className="mt-4 text-2xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs + Content */}
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <div className="flex gap-2 overflow-x-auto border-b border-gray-200 px-3 py-3 sm:px-5">
          {archiveTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#F2CF7E] text-black'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <i className={tab.icon} />
              {tab.label}
              {tabCounts[tab.id] != null && tab.id !== 'overview' && (
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-gray-700">{tabCounts[tab.id]}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-6">
          {/* ============ OVERVIEW ============ */}
          {activeTab === 'overview' && (
            <div className="grid gap-6 xl:grid-cols-[1.25fr,0.95fr]">
              <div className="space-y-6">
                {/* Participants */}
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Participants</h2>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600">
                      {archive.participantNames?.length || archive.participants?.length || 0} joined
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {(archive.participants || []).length === 0 && (
                      <p className="text-sm text-gray-500">No participant summary was captured for this meeting.</p>
                    )}
                    {(archive.participants || []).map(participant => (
                      <div key={participant.name} className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {participant.name}
                              {participant.name === currentUserName && <span className="ml-1 text-xs text-blue-600">(You)</span>}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {participant.isHost ? '⭐ Host' : 'Participant'}
                              {participant.joinedAt ? ` • Joined ${formatDateTime(participant.joinedAt)}` : ''}
                            </p>
                          </div>
                          <span className="rounded-full bg-[#F8F2DE] px-2.5 py-1 text-xs font-semibold text-[#8a6a1e]">
                            {participant.points || 0} pts
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* What was stored */}
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                  <h2 className="text-lg font-semibold text-gray-900">What was stored</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      { label: 'Chat history', value: summary.chatCount ?? archive.chatMessages?.length ?? 0, icon: 'ri-message-3-line' },
                      { label: 'Shared notes', value: summary.noteCount ?? archive.sharedNotes?.length ?? 0, icon: 'ri-sticky-note-line' },
                      { label: 'Shared tasks', value: summary.taskCount ?? archive.tasks?.length ?? 0, icon: 'ri-calendar-todo-line' },
                      { label: 'Shared resources', value: summary.resourceCount ?? archive.resources?.length ?? 0, icon: 'ri-folder-line' },
                      { label: 'Folders', value: summary.folderCount ?? archive.folders?.length ?? 0, icon: 'ri-folder-open-line' },
                      { label: 'Quiz submissions', value: summary.quizSubmissionCount ?? archive.quizResults?.length ?? 0, icon: 'ri-questionnaire-line' },
                    ].map(item => (
                      <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F8F2DE] text-[#8a6a1e]">
                            <i className={item.icon} />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{item.value}</p>
                            <p className="text-xs text-gray-500">{item.label}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {/* Leaderboard */}
                <div className="rounded-2xl border border-[#F2CF7E]/40 bg-[#F8F2DE] p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Leaderboard</h2>
                    <i className="ri-trophy-line text-xl text-[#8a6a1e]" />
                  </div>
                  {(archive.leaderboard || []).length === 0 ? (
                    <p className="mt-4 text-sm text-gray-600">No points were recorded during this session.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {(archive.leaderboard || []).map((entry, i) => (
                        <div key={entry.name} className="flex items-center justify-between rounded-2xl bg-white/80 px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                              i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {entry.rank}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {entry.name}
                                {entry.name === currentUserName && <span className="ml-1 text-xs text-blue-600">(You)</span>}
                              </p>
                              <p className="text-xs text-gray-500">{entry.activities?.length || 0} activities</p>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-[#8a6a1e]">{entry.points} pts</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Retention */}
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <h2 className="text-lg font-semibold text-gray-900">Retention</h2>
                  <p className="mt-4 text-sm text-gray-600">
                    This archive stays accessible until {formatDateTime(archive.expiresAt)} and then expires automatically.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ============ CHAT ============ */}
          {activeTab === 'chat' && (
            (archive.chatMessages || []).length === 0 ? (
              <EmptyArchiveState icon="ri-message-3-line" title="No chat history saved" description="No shared chat messages were stored for this session." />
            ) : (
              <div className="space-y-3">
                {(archive.chatMessages || []).map(message => {
                  const isSystem = message.type === 'system'
                  const isAI = message.content?.startsWith('🤖 AI:')
                  return isSystem ? (
                    <div key={message.id} className="text-center">
                      <span className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs font-medium text-yellow-700">
                        <i className="ri-information-line" />
                        {message.content}
                      </span>
                    </div>
                  ) : (
                    <div key={message.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {message.user || 'User'}
                            {message.user === currentUserName && <span className="ml-1 text-xs text-blue-600">(You)</span>}
                          </p>
                          <p className="text-xs text-gray-500">{message.time || formatDateTime(message.timestamp)}</p>
                        </div>
                        {isAI && (
                          <span className="rounded-full bg-[#F8F2DE] px-2.5 py-1 text-xs font-semibold text-[#8a6a1e]">AI reply</span>
                        )}
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                        {isAI ? message.content.replace('🤖 AI: ', '') : message.content}
                      </p>
                    </div>
                  )
                })}
              </div>
            )
          )}

          {/* ============ NOTES ============ */}
          {activeTab === 'notes' && (
            (archive.sharedNotes || []).length === 0 ? (
              <EmptyArchiveState icon="ri-sticky-note-line" title="No shared notes saved" description="This meeting did not include any shared notes." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {(archive.sharedNotes || []).map(note => (
                  <div key={note.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-gray-900">{note.title || 'Untitled note'}</h3>
                        <p className="mt-1 text-xs text-gray-500">
                          By {note.createdBy || 'Unknown'}
                          {note.updatedAt ? ` • Updated ${formatDateTime(note.updatedAt)}` : ''}
                        </p>
                      </div>
                      <i className="ri-file-text-line text-xl text-[#b48b2d]" />
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-gray-700">{note.content || 'No note content saved.'}</p>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ============ TASKS ============ */}
          {activeTab === 'tasks' && (
            (archive.tasks || []).length === 0 ? (
              <EmptyArchiveState icon="ri-calendar-todo-line" title="No tasks saved" description="No shared tasks were created during this meeting." />
            ) : (
              <div className="space-y-3">
                {(archive.tasks || []).map(task => (
                  <div key={task.id} className={`rounded-2xl border p-4 ${task.completed ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <i className={`text-lg ${task.completed ? 'ri-checkbox-circle-fill text-green-600' : 'ri-checkbox-blank-circle-line text-gray-400'}`} />
                          <h3 className="text-sm font-semibold text-gray-900">{task.text}</h3>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="rounded-full bg-white px-2.5 py-1">Priority: {task.priority || 'medium'}</span>
                          <span className="rounded-full bg-white px-2.5 py-1">Assigned: {task.assignedTo || 'all'}</span>
                          <span className="rounded-full bg-white px-2.5 py-1">Created by {task.createdBy || 'Unknown'}</span>
                          {task.dueDate && <span className="rounded-full bg-white px-2.5 py-1">Due {formatDateTime(task.dueDate)}</span>}
                          {task.completedBy && <span className="rounded-full bg-white px-2.5 py-1">Completed by {task.completedBy}</span>}
                        </div>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${task.completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {task.completed ? 'Completed' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* ============ RESOURCES (with previews) ============ */}
          {activeTab === 'resources' && (
            (archive.resources || []).length === 0 && (archive.folders || []).length === 0 ? (
              <EmptyArchiveState icon="ri-folder-line" title="No resources saved" description="No folders or files were shared during this meeting." />
            ) : (
              <div className="space-y-6">
                {(archive.folders || []).length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Folders</h2>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {(archive.folders || []).map(folder => {
                        const folderResources = (archive.resources || []).filter(r => r.folderId === folder.id)
                        return (
                          <div key={folder.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F8F2DE] text-[#8a6a1e]">
                                <i className="ri-folder-open-line" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{folder.name}</p>
                                <p className="text-xs text-gray-500">
                                  {folderResources.length} file{folderResources.length !== 1 ? 's' : ''} • By {folder.createdBy || 'Unknown'}
                                </p>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {(archive.resources || []).length > 0 && (
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Shared files and links</h2>
                    <div className="mt-4 space-y-4">
                      {(archive.resources || []).map(resource => (
                        <div key={resource.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[#8a6a1e] shadow-sm">
                                  <i className={getFileIcon(resource)} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{resource.name}</p>
                                  <p className="text-xs text-gray-500">
                                    Shared by {resource.uploadedBy || 'Unknown'}
                                    {resource.uploadedAt ? ` • ${formatDateTime(resource.uploadedAt)}` : ''}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                <span className="rounded-full bg-white px-2.5 py-1">{resource.type || 'file'}</span>
                                <span className="rounded-full bg-white px-2.5 py-1">{resource.size || 'Unknown size'}</span>
                                {resource.folderId && (
                                  <span className="rounded-full bg-white px-2.5 py-1">
                                    <i className="ri-folder-line mr-1" />
                                    In folder
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 shrink-0">
                              {resource.fileUrl && (
                                <>
                                  <a
                                    href={getFileUrl(resource.fileUrl)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 rounded-full bg-[#F2CF7E] px-4 py-2 text-sm font-medium text-black hover:bg-[#e0bd6c] transition-colors"
                                  >
                                    <i className="ri-external-link-line" />
                                    Open
                                  </a>
                                  <a
                                    href={getFileUrl(resource.fileUrl)}
                                    download={resource.name}
                                    className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                                    title="Download"
                                  >
                                    <i className="ri-download-line" />
                                  </a>
                                </>
                              )}
                            </div>
                          </div>

                          {/* File preview */}
                          {resource.fileUrl && <ResourcePreview resource={resource} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* ============ QUIZ (Host vs Participant view) ============ */}
          {activeTab === 'quiz' && (
            (!archive.activeQuiz && quizResults.length === 0) ? (
              <EmptyArchiveState icon="ri-questionnaire-line" title="No quiz data saved" description="No shared quiz was active in this meeting archive." />
            ) : (
              <div className="space-y-6">
                {/* Quiz Leaderboard — visible to EVERYONE */}
                {sortedResults.length > 0 && (
                  <div className="rounded-2xl border border-[#F2CF7E]/40 bg-gradient-to-br from-[#F8F2DE] to-amber-50 p-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-semibold text-gray-900">
                        <i className="ri-trophy-line text-[#8a6a1e] mr-2" />
                        Quiz Leaderboard
                      </h2>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-600">
                        {sortedResults.length} submission{sortedResults.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {sortedResults.map((result, index) => {
                        const pct = result.percentage ?? Math.round(((result.score || result.correct || 0) / Math.max(result.total || 1, 1)) * 100)
                        return (
                          <div key={`${result.userName}-${index}`} className="flex items-center gap-3 rounded-2xl bg-white/80 px-4 py-3">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-yellow-400 text-white' : index === 1 ? 'bg-gray-300 text-white' : index === 2 ? 'bg-orange-400 text-white' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {index + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900">
                                {result.userName}
                                {result.userName === currentUserName && <span className="ml-1 text-xs text-blue-600">(You)</span>}
                              </p>
                              <p className="text-xs text-gray-500">
                                Score: {result.correct ?? result.score ?? 0}/{result.total || 0}
                                {result.timeTaken != null ? ` • ${result.timeTaken}s` : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`text-lg font-bold ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-500'}`}>
                                {pct}%
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Quiz Config Summary — visible to everyone */}
                {archive.activeQuiz && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Quiz Summary</h2>
                        <p className="mt-1 text-sm text-gray-500">Created by {archive.activeQuiz.createdBy || archive.createdByName || 'Host'}</p>
                      </div>
                      <span className="rounded-full bg-[#F8F2DE] px-3 py-1 text-xs font-semibold text-[#8a6a1e]">
                        {quizQuestions.length} questions
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                      <span className="rounded-full bg-white px-3 py-1">Time limit: {archive.activeQuiz.timeMinutes || 0} min</span>
                      <span className="rounded-full bg-white px-3 py-1">Submissions: {quizResults.length}</span>
                    </div>
                  </div>
                )}

                {/* HOST ONLY: Full quiz questions with correct answers */}
                {isHost && quizQuestions.length > 0 && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                          <i className="ri-shield-star-line text-blue-600 mr-2" />
                          Quiz Questions & Answers
                        </h2>
                        <p className="mt-1 text-xs text-blue-600">Visible only to you as the host</p>
                      </div>
                      <button
                        onClick={() => setExpandedQuestions(!expandedQuestions)}
                        className="rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors"
                      >
                        {expandedQuestions ? 'Collapse' : 'Expand All'}
                        <i className={`ml-1 ${expandedQuestions ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'}`} />
                      </button>
                    </div>

                    {expandedQuestions && (
                      <div className="mt-4 space-y-4">
                        {quizQuestions.map((q, qi) => (
                          <div key={qi} className="rounded-xl border border-gray-200 bg-white p-4">
                            <p className="text-sm font-semibold text-gray-900 mb-3">
                              Q{qi + 1}. {q.question}
                            </p>
                            <div className="space-y-1.5">
                              {(q.options || []).map((opt, oi) => (
                                <div
                                  key={oi}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                                    oi === q.correct
                                      ? 'bg-green-100 border border-green-300 text-green-800 font-medium'
                                      : 'bg-gray-50 text-gray-700'
                                  }`}
                                >
                                  {oi === q.correct && <i className="ri-check-line text-green-600" />}
                                  <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                                </div>
                              ))}
                            </div>
                            {q.explanation && (
                              <p className="mt-3 text-xs text-gray-500 italic bg-gray-50 rounded-lg px-3 py-2">
                                💡 {q.explanation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* PARTICIPANT view: message that only leaderboard is shown */}
                {!isHost && quizQuestions.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 px-5 py-4 text-center">
                    <i className="ri-lock-line text-2xl text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      Quiz questions and answers are only visible to the host.
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      You can view the leaderboard above to see how everyone performed.
                    </p>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}