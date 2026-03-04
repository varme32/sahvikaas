import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getSessions, createSession, updateSession, deleteSession,
  getExams, createExam, updateExam, deleteExam,
  getEvents, createEvent, updateEvent, deleteEvent,
  getReminders, createReminder, updateReminder, deleteReminder,
} from '../../lib/api'

// ─── Color Palette for user items ───
const COLORS = [
  { color: 'from-indigo-500 to-purple-500', bg: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-400' },
  { color: 'from-teal-500 to-emerald-500', bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-400' },
  { color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-400' },
  { color: 'from-pink-500 to-rose-500', bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-400' },
  { color: 'from-blue-500 to-cyan-500', bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-400' },
  { color: 'from-violet-500 to-purple-500', bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-400' },
  { color: 'from-green-500 to-emerald-500', bg: 'bg-green-50', text: 'text-green-600', border: 'border-green-400' },
  { color: 'from-rose-500 to-red-500', bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-400' },
  { color: 'from-cyan-500 to-blue-500', bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-400' },
  { color: 'from-orange-500 to-red-500', bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-400' },
]

function getColorByIndex(i) { return COLORS[i % COLORS.length] }

// ─── Helpers ───
function getDaysUntil(dateStr) {
  const now = new Date(); now.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  return Math.ceil((target - now) / 86400000)
}

function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getRelativeLabel(dateStr) {
  const d = getDaysUntil(dateStr)
  if (d < 0) return `${Math.abs(d)}d ago`
  if (d === 0) return 'Today'
  if (d === 1) return 'Tomorrow'
  if (d <= 7) return `In ${d} days`
  return formatDateShort(dateStr)
}

// ─── Countdown Hook ───
function useCountdown(targetDateStr) {
  const [tl, setTl] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: false })
  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDateStr).getTime() - Date.now()
      if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true }
      return { days: Math.floor(diff / 86400000), hours: Math.floor((diff % 86400000) / 3600000), minutes: Math.floor((diff % 3600000) / 60000), seconds: Math.floor((diff % 60000) / 1000), expired: false }
    }
    setTl(calc())
    const id = setInterval(() => setTl(calc()), 1000)
    return () => clearInterval(id)
  }, [targetDateStr])
  return tl
}

function CountdownDisplay({ dateStr }) {
  const tl = useCountdown(dateStr)
  if (tl.expired) return <span className="text-xs font-medium text-green-600">Done</span>
  return (
    <div className="flex gap-1.5">
      {[{ v: tl.days, l: 'd' }, { v: tl.hours, l: 'h' }, { v: tl.minutes, l: 'm' }, { v: tl.seconds, l: 's' }].map(u => (
        <div key={u.l} className="flex flex-col items-center bg-gray-50 rounded-md px-1.5 py-0.5 min-w-[32px]">
          <span className="text-xs font-bold text-gray-900">{String(u.v).padStart(2, '0')}</span>
          <span className="text-[9px] text-gray-400 uppercase">{u.l}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Generic Form Modal ───
function FormModal({ title, fields, onSubmit, onClose }) {
  const [values, setValues] = useState(() => {
    const v = {}
    fields.forEach(f => { v[f.key] = f.default || '' })
    return v
  })

  const updateField = (key, val) => setValues(prev => ({ ...prev, [key]: val }))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200 shrink-0">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><i className="ri-close-line text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-sm font-medium text-gray-700 block mb-1">{f.label}</label>
              {f.type === 'select' ? (
                <select value={values[f.key]} onChange={e => updateField(f.key, e.target.value)} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white">
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea value={values[f.key]} onChange={e => updateField(f.key, e.target.value)} rows={2} placeholder={f.placeholder || ''} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none" />
              ) : f.type === 'range' ? (
                <div className="flex items-center gap-3">
                  <input type="range" min="0" max="100" step="5" value={values[f.key]} onChange={e => updateField(f.key, e.target.value)} className="flex-1 accent-indigo-600" />
                  <span className="text-sm font-bold text-indigo-600 w-10 text-right">{values[f.key]}%</span>
                </div>
              ) : (
                <input type={f.type || 'text'} value={values[f.key]} onChange={e => updateField(f.key, e.target.value)} placeholder={f.placeholder || ''} className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
              )}
            </div>
          ))}
        </div>
        <div className="p-5 border-t border-gray-200 shrink-0">
          <button onClick={() => onSubmit(values)} className="w-full py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
            {title.includes('Edit') ? 'Save Changes' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm Delete Modal ───
function ConfirmModal({ message, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
            <i className="ri-delete-bin-line text-xl text-red-600" />
          </div>
          <p className="text-sm text-gray-700">{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 text-gray-700">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// TAB 1: MY SESSIONS (Upcoming + Completed)
// ═══════════════════════════════════════════
const sessionTypes = ['Study', 'Lab', 'Group Study', 'Meeting', 'Workshop', 'Revision', 'Class', 'Other']

function SessionsTab({ sessions, setSessions }) {
  const [filter, setFilter] = useState('upcoming')
  const [showAdd, setShowAdd] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const filtered = useMemo(() => {
    let result = sessions
    if (filter === 'upcoming') result = result.filter(s => s.status === 'upcoming')
    else if (filter === 'completed') result = result.filter(s => s.status === 'completed')
    return result.sort((a, b) => filter === 'completed' ? new Date(b.date) - new Date(a.date) : new Date(a.date) - new Date(b.date))
  }, [sessions, filter])

  const upcomingCount = sessions.filter(s => s.status === 'upcoming').length
  const completedCount = sessions.filter(s => s.status === 'completed').length
  const totalHours = sessions.filter(s => s.status === 'completed').reduce((a, s) => a + parseFloat(s.duration) || 0, 0)

  const nextSession = useMemo(() => {
    return sessions.filter(s => s.status === 'upcoming').sort((a, b) => new Date(a.date) - new Date(b.date))[0]
  }, [sessions])

  const toggleStatus = async (id) => {
    const session = sessions.find(s => s.id === id)
    if (!session) return
    const newStatus = session.status === 'upcoming' ? 'completed' : 'upcoming'
    setSessions(prev => prev.map(s => s.id === id ? { ...s, status: newStatus } : s))
    updateSession(id, { status: newStatus }).catch(() => {})
  }

  const handleDelete = async () => {
    setSessions(prev => prev.filter(s => s.id !== deleteId))
    deleteSession(deleteId).catch(() => {})
    setDeleteId(null)
  }

  const addSession = async (values) => {
    const newSession = {
      title: values.title,
      subject: values.subject,
      date: values.date,
      time: values.time,
      duration: values.duration,
      type: values.type,
      location: values.location,
      notes: values.notes,
      status: 'upcoming',
      colorIdx: Math.floor(Math.random() * COLORS.length),
    }
    try {
      const res = await createSession(newSession)
      if (res?.ok && res.session) {
        setSessions(prev => [...prev, { ...res.session, id: res.session._id || res.session.id }])
      } else {
        setSessions(prev => [...prev, { ...newSession, id: Date.now() }])
      }
    } catch {
      setSessions(prev => [...prev, { ...newSession, id: Date.now() }])
    }
    setShowAdd(false)
  }

  return (
    <div className="space-y-4">
      {/* Next Session Banner */}
      {nextSession && (
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-xl p-4 text-white relative overflow-hidden">
          <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
          <div className="absolute bottom-0 right-12 w-16 h-16 rounded-full bg-white/5" />
          <p className="text-xs text-white/70 font-medium uppercase mb-1">Next Session</p>
          <h3 className="font-semibold text-lg">{nextSession.title}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-sm text-white/80">
            <span className="flex items-center gap-1"><i className="ri-calendar-line" />{getRelativeLabel(nextSession.date)}</span>
            <span className="flex items-center gap-1"><i className="ri-time-line" />{nextSession.time}</span>
            <span className="flex items-center gap-1"><i className="ri-map-pin-line" />{nextSession.location}</span>
          </div>
        </div>
      )}

      {/* Stats + Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-3">
          {[
            { label: 'Upcoming', value: upcomingCount, icon: 'ri-time-fill', color: 'text-blue-500', bg: 'bg-blue-50' },
            { label: 'Completed', value: completedCount, icon: 'ri-check-double-fill', color: 'text-green-500', bg: 'bg-green-50' },
            { label: 'Study Hours', value: `${totalHours}h`, icon: 'ri-hourglass-fill', color: 'text-amber-500', bg: 'bg-amber-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-3 py-2 flex items-center gap-2">
              <div className={`w-7 h-7 rounded-md ${s.bg} flex items-center justify-center`}>
                <i className={`${s.icon} text-sm ${s.color}`} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{s.value}</p>
                <p className="text-[10px] text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors w-fit">
          <i className="ri-add-line" /> Add Session
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {['upcoming', 'completed', 'all'].map(f => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{f}</button>
        ))}
      </div>

      {/* Session List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <i className="ri-calendar-check-line text-4xl text-gray-300" />
          <p className="text-sm text-gray-500 mt-2">No {filter} sessions</p>
          <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-indigo-600 font-medium hover:text-indigo-700">+ Add a session</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const c = getColorByIndex(s.colorIdx)
            const isDone = s.status === 'completed'
            return (
              <div key={s.id} className={`bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-all ${isDone ? 'opacity-70' : ''}`}>
                <div className="flex">
                  <div className={`w-1.5 bg-gradient-to-b ${c.color}`} />
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>{s.type}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isDone ? 'bg-green-100 text-green-700' : getDaysUntil(s.date) === 0 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
                            {isDone ? '\u2713 Done' : getRelativeLabel(s.date)}
                          </span>
                        </div>
                        <h4 className={`font-semibold text-sm ${isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{s.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{s.subject}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1"><i className="ri-calendar-line" />{formatDateShort(s.date)}</span>
                          <span className="flex items-center gap-1"><i className="ri-time-line" />{s.time}</span>
                          <span className="flex items-center gap-1"><i className="ri-hourglass-line" />{s.duration}</span>
                          <span className="flex items-center gap-1"><i className="ri-map-pin-line" />{s.location}</span>
                        </div>
                        {s.notes && <p className="text-xs text-gray-400 mt-1.5 italic">{s.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggleStatus(s.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDone ? 'bg-green-50 hover:bg-green-100' : 'bg-gray-50 hover:bg-gray-100'}`} title={isDone ? 'Mark upcoming' : 'Mark done'}>
                          <i className={`text-sm ${isDone ? 'ri-arrow-go-back-line text-green-600' : 'ri-check-line text-gray-500'}`} />
                        </button>
                        <button onClick={() => setDeleteId(s.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 hover:bg-red-50 transition-colors" title="Delete">
                          <i className="ri-delete-bin-line text-sm text-gray-400 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <FormModal
          title="Add Session"
          fields={[
            { key: 'title', label: 'Title', placeholder: 'e.g. DSA Revision', default: '' },
            { key: 'subject', label: 'Subject', placeholder: 'e.g. Data Structures', default: '' },
            { key: 'date', label: 'Date', type: 'date', default: new Date().toISOString().split('T')[0] },
            { key: 'time', label: 'Time', type: 'time', default: '09:00' },
            { key: 'duration', label: 'Duration', placeholder: 'e.g. 2h', default: '1h' },
            { key: 'type', label: 'Type', type: 'select', options: sessionTypes, default: 'Study' },
            { key: 'location', label: 'Location', placeholder: 'e.g. Library, Lab 2, Online', default: '' },
            { key: 'notes', label: 'Notes (optional)', type: 'textarea', placeholder: 'Add any notes...', default: '' },
          ]}
          onSubmit={addSession}
          onClose={() => setShowAdd(false)}
        />
      )}

      {deleteId && <ConfirmModal message="Delete this session? This cannot be undone." onConfirm={handleDelete} onClose={() => setDeleteId(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════
// TAB 2: EXAMS
// ═══════════════════════════════════════════
function ExamsTab({ exams, setExams }) {
  const [examFilter, setExamFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const filtered = useMemo(() => {
    let result = exams
    if (examFilter !== 'all') result = result.filter(e => e.type.toLowerCase() === examFilter)
    return result.sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [exams, examFilter])

  const addExam = async (values) => {
    const newExam = {
      subject: values.subject,
      date: values.date,
      time: values.time,
      venue: values.venue,
      type: values.type,
      units: values.units,
      syllabusProgress: parseInt(values.syllabusProgress) || 0,
      notes: values.notes,
      colorIdx: Math.floor(Math.random() * COLORS.length),
    }
    try {
      const res = await createExam(newExam)
      if (res?.ok && res.exam) {
        setExams(prev => [...prev, { ...res.exam, id: res.exam._id || res.exam.id }])
      } else {
        setExams(prev => [...prev, { ...newExam, id: Date.now() }])
      }
    } catch {
      setExams(prev => [...prev, { ...newExam, id: Date.now() }])
    }
    setShowAdd(false)
  }

  const updateProgress = (id, newProgress) => {
    setExams(prev => prev.map(e => e.id === id ? { ...e, syllabusProgress: parseInt(newProgress) } : e))
    updateExam(id, { syllabusProgress: parseInt(newProgress) }).catch(() => {})
  }

  const handleDelete = () => {
    setExams(prev => prev.filter(e => e.id !== deleteId))
    deleteExam(deleteId).catch(() => {})
    setDeleteId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {['all', 'internal', 'external', 'quiz', 'viva'].map(f => (
            <button key={f} onClick={() => setExamFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${examFilter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{f}</button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors w-fit">
          <i className="ri-add-line" /> Add Exam
        </button>
      </div>

      {/* Exam Cards */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <i className="ri-file-list-line text-4xl text-gray-300" />
            <p className="text-sm text-gray-500 mt-2">No exams found</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-indigo-600 font-medium">+ Add an exam</button>
          </div>
        ) : filtered.map(exam => {
          const c = getColorByIndex(exam.colorIdx)
          const daysLeft = getDaysUntil(exam.date)
          const isPast = daysLeft < 0
          const isExamToday = daysLeft === 0

          return (
            <div key={exam.id} className={`bg-white rounded-xl border overflow-hidden transition-all hover:shadow-md ${isExamToday ? 'border-red-300 ring-1 ring-red-200' : 'border-gray-200'}`}>
              <div className="flex">
                <div className={`w-1.5 bg-gradient-to-b ${c.color}`} />
                <div className="flex-1 p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${exam.type === 'Internal' ? 'bg-blue-100 text-blue-700' : exam.type === 'External' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{exam.type}</span>
                        {isExamToday && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-red-500" />TODAY</span>}
                        {isPast && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-medium"><i className="ri-check-line text-xs" />Completed</span>}
                      </div>
                      <h4 className="font-semibold text-gray-900">{exam.subject}</h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><i className="ri-calendar-line" />{formatDateShort(exam.date)}</span>
                        <span className="flex items-center gap-1"><i className="ri-time-line" />{exam.time}</span>
                        <span className="flex items-center gap-1"><i className="ri-map-pin-line" />{exam.venue}</span>
                        <span className="flex items-center gap-1"><i className="ri-book-open-line" />{exam.units}</span>
                      </div>
                      {exam.notes && <p className="text-xs text-gray-400 mt-1 italic">{exam.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isPast && <CountdownDisplay dateStr={exam.date} />}
                      <button onClick={() => setDeleteId(exam.id)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-50 hover:bg-red-50 transition-colors" title="Delete">
                        <i className="ri-delete-bin-line text-sm text-gray-400" />
                      </button>
                    </div>
                  </div>

                  {/* Syllabus Progress (editable) */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-500">Syllabus Coverage</span>
                      <span className={`text-xs font-bold ${exam.syllabusProgress >= 75 ? 'text-green-600' : exam.syllabusProgress >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{exam.syllabusProgress}%</span>
                    </div>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={exam.syllabusProgress}
                      onChange={e => updateProgress(exam.id, e.target.value)}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer accent-indigo-600 bg-gray-100"
                    />
                    {!isPast && <p className="text-[10px] text-gray-400 mt-1">Drag to update progress</p>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Exam Timeline */}
      {exams.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Exam Timeline</h3>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-6">
              {exams.sort((a, b) => new Date(a.date) - new Date(b.date)).map(exam => {
                const daysLeft = getDaysUntil(exam.date)
                const isPast = daysLeft < 0
                return (
                  <div key={exam.id} className="relative flex gap-4">
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center shadow shrink-0 ${isPast ? 'bg-green-500' : daysLeft <= 3 ? 'bg-red-500' : 'bg-indigo-500'}`}>
                      <i className={`text-white text-xs ${isPast ? 'ri-check-line' : 'ri-file-list-line'}`} />
                    </div>
                    <div className="flex-1 pb-2">
                      <p className="text-sm font-semibold text-gray-900">{exam.subject}</p>
                      <p className="text-xs text-gray-500">{formatDateShort(exam.date)} \u2022 {exam.time} \u2022 {exam.type}</p>
                      {!isPast && <p className="text-xs text-indigo-600 font-medium mt-0.5">{daysLeft === 0 ? 'Today!' : `${daysLeft} days to go`}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <FormModal
          title="Add Exam"
          fields={[
            { key: 'subject', label: 'Subject', placeholder: 'e.g. Data Structures', default: '' },
            { key: 'date', label: 'Date', type: 'date', default: '' },
            { key: 'time', label: 'Time', type: 'time', default: '10:00' },
            { key: 'venue', label: 'Venue', placeholder: 'e.g. Hall A', default: '' },
            { key: 'type', label: 'Type', type: 'select', options: ['Internal', 'External', 'Quiz', 'Viva'], default: 'Internal' },
            { key: 'units', label: 'Syllabus', placeholder: 'e.g. Units 1-3', default: '' },
            { key: 'syllabusProgress', label: 'Current Preparation (%)', type: 'range', default: '0' },
            { key: 'notes', label: 'Notes (optional)', type: 'textarea', placeholder: 'Important topics...', default: '' },
          ]}
          onSubmit={addExam}
          onClose={() => setShowAdd(false)}
        />
      )}

      {deleteId && <ConfirmModal message="Delete this exam?" onConfirm={handleDelete} onClose={() => setDeleteId(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════
// TAB 3: EVENTS
// ═══════════════════════════════════════════
function EventsTab({ events, setEvents }) {
  const [catFilter, setCatFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const cats = ['all', 'Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar']

  const filtered = useMemo(() => {
    let result = events
    if (catFilter !== 'all') result = result.filter(e => e.category === catFilter)
    return result.sort((a, b) => new Date(a.date) - new Date(b.date))
  }, [events, catFilter])

  const toggleRegistered = (id) => {
    const event = events.find(e => e.id === id)
    if (!event) return
    setEvents(prev => prev.map(e => e.id === id ? { ...e, registered: !e.registered } : e))
    updateEvent(id, { registered: !event.registered }).catch(() => {})
  }

  const addEvent = async (values) => {
    const newEvent = {
      title: values.title,
      date: values.date,
      time: values.time,
      venue: values.venue,
      category: values.category,
      desc: values.desc,
      status: 'upcoming',
      registered: false,
      colorIdx: Math.floor(Math.random() * COLORS.length),
    }
    try {
      const res = await createEvent(newEvent)
      if (res?.ok && res.event) {
        setEvents(prev => [...prev, { ...res.event, id: res.event._id || res.event.id }])
      } else {
        setEvents(prev => [...prev, { ...newEvent, id: Date.now() }])
      }
    } catch {
      setEvents(prev => [...prev, { ...newEvent, id: Date.now() }])
    }
    setShowAdd(false)
  }

  const handleDelete = () => {
    setEvents(prev => prev.filter(e => e.id !== deleteId))
    deleteEvent(deleteId).catch(() => {})
    setDeleteId(null)
  }

  const statusColor = (s) => s === 'ongoing' ? 'bg-green-100 text-green-700' : s === 'completed' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto study-feature-tabs">
          {cats.map(c => (
            <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all capitalize ${catFilter === c ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{c}</button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors w-fit">
          <i className="ri-add-line" /> Add Event
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <i className="ri-calendar-event-line text-4xl text-gray-300" />
          <p className="text-sm text-gray-500 mt-2">No events found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(event => {
            const c = getColorByIndex(event.colorIdx)
            return (
              <div key={event.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
                <div className={`h-1.5 bg-gradient-to-r ${c.color}`} />
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">{event.category}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${statusColor(event.status)}`}>{event.status}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-indigo-50 text-indigo-600">{getRelativeLabel(event.date)}</span>
                    </div>
                    <button onClick={() => setDeleteId(event.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors shrink-0">
                      <i className="ri-delete-bin-line text-xs text-gray-400" />
                    </button>
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">{event.title}</h4>
                  <p className="text-xs text-gray-500 mb-3 line-clamp-2">{event.desc}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1"><i className="ri-calendar-line" />{formatDateShort(event.date)}</span>
                    <span className="flex items-center gap-1"><i className="ri-time-line" />{event.time}</span>
                    <span className="flex items-center gap-1"><i className="ri-map-pin-line" />{event.venue}</span>
                  </div>
                  <button
                    onClick={() => toggleRegistered(event.id)}
                    className={`w-full py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                      event.registered
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : `text-white bg-gradient-to-r ${c.color} hover:opacity-90`
                    }`}
                  >
                    <i className={event.registered ? 'ri-check-line' : 'ri-user-add-line'} />
                    {event.registered ? 'Registered \u2713' : 'Register'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAdd && (
        <FormModal
          title="Add Event"
          fields={[
            { key: 'title', label: 'Event Name', placeholder: 'e.g. Hackathon 2026', default: '' },
            { key: 'date', label: 'Date', type: 'date', default: '' },
            { key: 'time', label: 'Time', placeholder: 'e.g. 09:00 - 18:00', default: '' },
            { key: 'venue', label: 'Venue', placeholder: 'e.g. Main Auditorium', default: '' },
            { key: 'category', label: 'Category', type: 'select', options: ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar'], default: 'Technical' },
            { key: 'desc', label: 'Description', type: 'textarea', placeholder: 'Event details...', default: '' },
          ]}
          onSubmit={addEvent}
          onClose={() => setShowAdd(false)}
        />
      )}

      {deleteId && <ConfirmModal message="Delete this event?" onConfirm={handleDelete} onClose={() => setDeleteId(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════
// TAB 4: CALENDAR
// ═══════════════════════════════════════════
function CalendarTab({ sessions, exams, events, reminders }) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const calendarDays = useMemo(() => {
    const days = []
    const startPad = firstDay === 0 ? 6 : firstDay - 1
    for (let i = 0; i < startPad; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    return days
  }, [firstDay, daysInMonth])

  const getDotsForDate = useCallback((day) => {
    if (!day) return []
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dots = []
    if (sessions.some(s => s.date === dateStr)) dots.push('session')
    if (exams.some(e => e.date === dateStr)) dots.push('exam')
    if (events.some(e => e.date === dateStr)) dots.push('event')
    if (reminders.some(r => r.date === dateStr)) dots.push('reminder')
    return dots
  }, [year, month, sessions, exams, events, reminders])

  const getDateDetails = useCallback((day) => {
    if (!day) return []
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const items = []
    sessions.filter(s => s.date === dateStr).forEach(s => items.push({ type: 'session', title: s.title, time: s.time, detail: `${s.subject} \u2022 ${s.location}` }))
    exams.filter(e => e.date === dateStr).forEach(e => items.push({ type: 'exam', title: `${e.type}: ${e.subject}`, time: e.time, detail: e.venue }))
    events.filter(e => e.date === dateStr).forEach(e => items.push({ type: 'event', title: e.title, time: e.time, detail: e.venue }))
    reminders.filter(r => r.date === dateStr).forEach(r => items.push({ type: 'reminder', title: r.title, time: r.time, detail: r.type }))
    return items
  }, [year, month, sessions, exams, events, reminders])

  const dotColorMap = { session: 'bg-blue-500', exam: 'bg-red-500', event: 'bg-green-500', reminder: 'bg-gray-800' }
  const typeStyleMap = {
    session: { icon: 'ri-book-read-line', bg: 'bg-blue-50', text: 'text-blue-600' },
    exam: { icon: 'ri-file-list-line', bg: 'bg-red-50', text: 'text-red-600' },
    event: { icon: 'ri-calendar-event-line', bg: 'bg-green-50', text: 'text-green-600' },
    reminder: { icon: 'ri-alarm-line', bg: 'bg-gray-100', text: 'text-gray-600' },
  }

  const selectedDetails = selectedDate ? getDateDetails(selectedDate) : []

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><i className="ri-arrow-left-s-line text-gray-600" /></button>
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-gray-900">{monthName}</h3>
            <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(today.getDate()) }} className="text-xs px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-600 font-medium hover:bg-indigo-100">Today</button>
          </div>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center"><i className="ri-arrow-right-s-line text-gray-600" /></button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center text-[10px] font-medium text-gray-400 uppercase py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, idx) => {
            if (day === null) return <div key={idx} />
            const isTodayDate = day === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            const isSelected = day === selectedDate
            const dots = getDotsForDate(day)
            return (
              <button key={idx} onClick={() => setSelectedDate(day === selectedDate ? null : day)}
                className={`relative flex flex-col items-center justify-center py-1.5 sm:py-2 rounded-lg text-sm transition-all ${
                  isSelected ? 'bg-indigo-600 text-white shadow-md' :
                  isTodayDate ? 'bg-indigo-50 text-indigo-600 font-bold ring-2 ring-indigo-200' :
                  'hover:bg-gray-50 text-gray-700'
                }`}>
                <span>{day}</span>
                {dots.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dots.slice(0, 3).map((dot, di) => (
                      <div key={di} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white/70' : dotColorMap[dot]}`} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-gray-100">
          {[{ color: 'bg-blue-500', label: 'Sessions' }, { color: 'bg-red-500', label: 'Exams' }, { color: 'bg-green-500', label: 'Events' }, { color: 'bg-gray-800', label: 'Reminders' }].map(l => (
            <div key={l.label} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${l.color}`} />
              <span className="text-[10px] text-gray-500">{l.label}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedDate && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
          <h3 className="font-semibold text-gray-900 mb-3">{new Date(year, month, selectedDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
          {selectedDetails.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Nothing scheduled for this date</p>
          ) : (
            <div className="space-y-2">
              {selectedDetails.map((item, i) => {
                const style = typeStyleMap[item.type]
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center shrink-0`}>
                      <i className={`${style.icon} ${style.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-500">{item.time} \u2022 {item.detail}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium capitalize ${style.bg} ${style.text}`}>{item.type}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// TAB 5: REMINDERS
// ═══════════════════════════════════════════
function RemindersTab({ reminders, setReminders }) {
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  const toggleDone = (id) => {
    const reminder = reminders.find(r => r.id === id)
    if (!reminder) return
    setReminders(prev => prev.map(r => r.id === id ? { ...r, done: !r.done } : r))
    updateReminder(id, { done: !reminder.done }).catch(() => {})
  }

  const filtered = useMemo(() => {
    let result = reminders
    if (priorityFilter !== 'all') result = result.filter(r => r.priority === priorityFilter)
    return result.sort((a, b) => { if (a.done !== b.done) return a.done ? 1 : -1; return new Date(a.date) - new Date(b.date) })
  }, [reminders, priorityFilter])

  const overdue = filtered.filter(r => !r.done && getDaysUntil(r.date) < 0)
  const upcoming = filtered.filter(r => !r.done && getDaysUntil(r.date) >= 0)
  const completed = filtered.filter(r => r.done)

  const priorityStyle = { high: { dot: 'bg-red-500', bg: 'bg-red-50', color: 'text-red-500' }, medium: { dot: 'bg-amber-400', bg: 'bg-amber-50', color: 'text-amber-500' }, low: { dot: 'bg-green-500', bg: 'bg-green-50', color: 'text-green-500' } }
  const typeIcons = { assignment: 'ri-file-edit-line', submission: 'ri-upload-2-line', meeting: 'ri-team-line', study: 'ri-book-read-line', exam: 'ri-file-list-line', other: 'ri-alarm-line' }

  const addReminder = async (values) => {
    const newReminder = { title: values.title, date: values.date, time: values.time, type: values.type, priority: values.priority, done: false }
    try {
      const res = await createReminder(newReminder)
      if (res?.ok && res.reminder) {
        setReminders(prev => [...prev, { ...res.reminder, id: res.reminder._id || res.reminder.id }])
      } else {
        setReminders(prev => [...prev, { ...newReminder, id: Date.now() }])
      }
    } catch {
      setReminders(prev => [...prev, { ...newReminder, id: Date.now() }])
    }
    setShowAdd(false)
  }

  const handleDelete = () => { setReminders(prev => prev.filter(r => r.id !== deleteId)); deleteReminder(deleteId).catch(() => {}); setDeleteId(null) }

  function ReminderCard({ r }) {
    const daysLeft = getDaysUntil(r.date)
    const ps = priorityStyle[r.priority]
    const isOverdueItem = !r.done && daysLeft < 0
    return (
      <div className={`flex items-center gap-3 p-3 sm:p-4 rounded-xl border transition-all hover:shadow-sm ${r.done ? 'bg-gray-50 border-gray-200 opacity-60' : isOverdueItem ? 'bg-red-50/50 border-red-200' : 'bg-white border-gray-200'}`}>
        <button onClick={() => toggleDone(r.id)} className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${r.done ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-indigo-400'}`}>
          {r.done && <i className="ri-check-line text-white text-xs" />}
        </button>
        <div className={`w-8 h-8 rounded-lg ${ps.bg} flex items-center justify-center shrink-0`}>
          <i className={`${typeIcons[r.type] || typeIcons.other} ${ps.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${r.done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{r.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-gray-500">{formatDateShort(r.date)} \u2022 {r.time}</span>
            {!r.done && <span className={`text-xs font-medium ${isOverdueItem ? 'text-red-600' : daysLeft <= 3 ? 'text-amber-600' : 'text-gray-500'}`}>{isOverdueItem ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className={`w-2 h-2 rounded-full ${ps.dot}`} />
          <button onClick={() => setDeleteId(r.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 transition-colors"><i className="ri-delete-bin-line text-xs text-gray-400" /></button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
          {['all', 'high', 'medium', 'low'].map(f => (
            <button key={f} onClick={() => setPriorityFilter(f)} className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${priorityFilter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>{f}</button>
          ))}
        </div>
        <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors w-fit">
          <i className="ri-add-line" /> Add Reminder
        </button>
      </div>

      {overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold text-red-600 uppercase">Overdue ({overdue.length})</span><div className="h-px flex-1 bg-red-100" /></div>
          <div className="space-y-2">{overdue.map(r => <ReminderCard key={r.id} r={r} />)}</div>
        </div>
      )}
      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold text-gray-500 uppercase">Upcoming ({upcoming.length})</span><div className="h-px flex-1 bg-gray-100" /></div>
          <div className="space-y-2">{upcoming.map(r => <ReminderCard key={r.id} r={r} />)}</div>
        </div>
      )}
      {completed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><span className="text-xs font-bold text-green-600 uppercase">Completed ({completed.length})</span><div className="h-px flex-1 bg-green-100" /></div>
          <div className="space-y-2">{completed.map(r => <ReminderCard key={r.id} r={r} />)}</div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <i className="ri-notification-off-line text-4xl text-gray-300" />
          <p className="text-sm text-gray-500 mt-2">No reminders</p>
        </div>
      )}

      {showAdd && (
        <FormModal
          title="Add Reminder"
          fields={[
            { key: 'title', label: 'Title', placeholder: 'e.g. Submit assignment', default: '' },
            { key: 'date', label: 'Date', type: 'date', default: new Date().toISOString().split('T')[0] },
            { key: 'time', label: 'Time', type: 'time', default: '23:59' },
            { key: 'type', label: 'Type', type: 'select', options: ['assignment', 'submission', 'meeting', 'study', 'exam', 'other'], default: 'assignment' },
            { key: 'priority', label: 'Priority', type: 'select', options: ['high', 'medium', 'low'], default: 'medium' },
          ]}
          onSubmit={addReminder}
          onClose={() => setShowAdd(false)}
        />
      )}

      {deleteId && <ConfirmModal message="Delete this reminder?" onConfirm={handleDelete} onClose={() => setDeleteId(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN SCHEDULE PAGE
// ═══════════════════════════════════════════
const tabs = [
  { id: 'sessions', label: 'My Sessions', icon: 'ri-book-read-line' },
  { id: 'exams', label: 'Exams', icon: 'ri-file-list-line' },
  { id: 'events', label: 'Events', icon: 'ri-calendar-event-line' },
  { id: 'calendar', label: 'Calendar', icon: 'ri-calendar-2-line' },
  { id: 'reminders', label: 'Reminders', icon: 'ri-notification-3-line' },
]

export default function SchedulePage() {
  const [activeTab, setActiveTab] = useState('sessions')
  const [loading, setLoading] = useState(true)

  // State - starts empty, loaded from API
  const [sessions, setSessions] = useState([])
  const [exams, setExams] = useState([])
  const [events, setEvents] = useState([])
  const [reminders, setReminders] = useState([])

  // Fetch all data from API on mount
  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const [sessRes, examRes, eventRes, remRes] = await Promise.all([
          getSessions().catch(() => null),
          getExams().catch(() => null),
          getEvents().catch(() => null),
          getReminders().catch(() => null),
        ])
        if (!mounted) return
        if (sessRes?.ok) setSessions((sessRes.sessions || []).map(s => ({ ...s, id: s._id || s.id })))
        if (examRes?.ok) setExams((examRes.exams || []).map(e => ({ ...e, id: e._id || e.id })))
        if (eventRes?.ok) setEvents((eventRes.events || []).map(e => ({ ...e, id: e._id || e.id })))
        if (remRes?.ok) setReminders((remRes.reminders || []).map(r => ({ ...r, id: r._id || r.id })))
      } catch { /* ignore */ }
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  // Stats
  const upcomingSessions = sessions.filter(s => s.status === 'upcoming').length
  const upcomingExams = exams.filter(e => getDaysUntil(e.date) > 0).length
  const activeReminders = reminders.filter(r => !r.done).length
  const completedSessions = sessions.filter(s => s.status === 'completed').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading schedule...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Schedule</h1>
        <p className="text-sm text-gray-500 mt-1">Plan your study sessions, track exams, and never miss a deadline</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Upcoming Sessions', value: upcomingSessions, icon: 'ri-book-read-fill', color: 'text-indigo-500', bg: 'bg-indigo-50' },
          { label: 'Completed', value: completedSessions, icon: 'ri-check-double-fill', color: 'text-green-500', bg: 'bg-green-50' },
          { label: 'Upcoming Exams', value: upcomingExams, icon: 'ri-alarm-warning-fill', color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Active Reminders', value: activeReminders, icon: 'ri-notification-fill', color: 'text-red-500', bg: 'bg-red-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-sm transition-shadow">
            <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-1`}>
              <i className={`${stat.icon} ${stat.color}`} />
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto study-feature-tabs">
        <div className="flex gap-1 min-w-fit">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}>
              <i className={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'sessions' && <SessionsTab sessions={sessions} setSessions={setSessions} />}
        {activeTab === 'exams' && <ExamsTab exams={exams} setExams={setExams} />}
        {activeTab === 'events' && <EventsTab events={events} setEvents={setEvents} />}
        {activeTab === 'calendar' && <CalendarTab sessions={sessions} exams={exams} events={events} reminders={reminders} />}
        {activeTab === 'reminders' && <RemindersTab reminders={reminders} setReminders={setReminders} />}
      </div>
    </div>
  )
}
