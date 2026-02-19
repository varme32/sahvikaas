import { useState, useRef, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import VideoPanel from './components/VideoPanel'
import AIAssistant from './components/AIAssistant'
import ChatPanel from './components/ChatPanel'
import NotesPanel from './components/NotesPanel'
import PdfSummarizerPanel from './components/PdfSummarizerPanel'
import QuizGeneratorPanel from './components/QuizGeneratorPanel'
import ResourcesPanel from './components/ResourcesPanel'
import TasksPanel from './components/TasksPanel'
import SettingsModal from './components/SettingsModal'
import PointsModal from './components/PointsModal'
import VoiceAssistant from './components/VoiceAssistant'

const featureTabs = [
  { id: 'chat', label: 'Chat', icon: 'ri-message-3-line' },
  { id: 'notes', label: 'Notes', icon: 'ri-file-text-line' },
  { id: 'pdf', label: 'PDF Summarizer', icon: 'ri-file-pdf-2-line' },
  { id: 'quiz', label: 'Quiz Generator', icon: 'ri-questionnaire-line' },
  { id: 'resources', label: 'Resources', icon: 'ri-folder-line' },
  { id: 'tasks', label: 'Tasks', icon: 'ri-calendar-todo-line' },
]

// Mobile panel tabs for switching between Video/AI and Features
const mobilePanelTabs = [
  { id: 'video', label: 'Video', icon: 'ri-vidicon-line' },
  { id: 'ai', label: 'AI Assistant', icon: 'ri-robot-line' },
  { id: 'features', label: 'Features', icon: 'ri-apps-line' },
]

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < breakpoint)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [breakpoint])
  return isMobile
}

function useIsTablet() {
  const [isTablet, setIsTablet] = useState(window.innerWidth >= 768 && window.innerWidth < 1024)
  useEffect(() => {
    const handleResize = () => setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return isTablet
}

export default function StudyRoomPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()

  // Media controls
  const [isMicOn, setIsMicOn] = useState(true)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  // Feature tab
  const [activeFeature, setActiveFeature] = useState('chat')

  // Mobile panel tab
  const [mobilePanel, setMobilePanel] = useState('video')

  // Mobile controls expanded
  const [controlsExpanded, setControlsExpanded] = useState(false)

  // Modals
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [pointsOpen, setPointsOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)

  // === Resizable panels ===
  const [verticalSplit, setVerticalSplit] = useState(50)
  const [horizontalSplit, setHorizontalSplit] = useState(50)

  const containerRef = useRef(null)
  const isDraggingV = useRef(false)
  const isDraggingH = useRef(false)
  const leftPanelRef = useRef(null)

  const handleMouseMove = useCallback((e) => {
    if (isMobile) return
    if (isDraggingV.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const pct = ((e.clientX - rect.left) / rect.width) * 100
      setVerticalSplit(Math.min(80, Math.max(20, pct)))
    }
    if (isDraggingH.current && leftPanelRef.current) {
      const rect = leftPanelRef.current.getBoundingClientRect()
      const pct = ((e.clientY - rect.top) / rect.height) * 100
      setHorizontalSplit(Math.min(80, Math.max(20, pct)))
    }
  }, [isMobile])

  const handleMouseUp = useCallback(() => {
    isDraggingV.current = false
    isDraggingH.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const startVerticalDrag = () => {
    if (isMobile) return
    isDraggingV.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const startHorizontalDrag = () => {
    if (isMobile) return
    isDraggingH.current = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }

  const handleEndMeeting = () => {
    if (confirm('Are you sure you want to leave this room?')) {
      navigate('/rooms')
    }
  }

  const renderFeatureContent = () => {
    switch (activeFeature) {
      case 'chat': return <ChatPanel />
      case 'notes': return <NotesPanel />
      case 'pdf': return <PdfSummarizerPanel />
      case 'quiz': return <QuizGeneratorPanel />
      case 'resources': return <ResourcesPanel />
      case 'tasks': return <TasksPanel />
      default: return <ChatPanel />
    }
  }

  // Effective split values (wider left panel on tablet)
  const effectiveVSplit = isTablet ? Math.max(verticalSplit, 45) : verticalSplit

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top Navigation Bar */}
      <nav className="study-nav bg-white border-b border-gray-200 px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between shrink-0 z-10 relative">
        {/* Left: User */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-100 flex items-center justify-center">
            <i className="ri-user-line text-lg sm:text-xl text-indigo-600" />
          </div>
          <div className="hidden xs:block">
            <h3 className="font-medium text-gray-900 text-sm">User</h3>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Online
            </div>
          </div>
        </div>

        {/* Center: Room */}
        <div className="study-nav-center text-center min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-gray-900 truncate">Study Room</h2>
          <p className="text-[10px] sm:text-xs text-gray-500">Room #{id || '—'}</p>
        </div>

        {/* Right: Controls - Desktop */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3 shrink-0">
          <div
            onClick={() => setPointsOpen(true)}
            className="flex items-center bg-indigo-50 px-2 lg:px-3 py-1.5 rounded-full cursor-pointer hover:bg-indigo-100 transition-colors"
          >
            <i className="ri-coins-line text-indigo-600 mr-1 lg:mr-1.5 text-sm" />
            <span className="font-semibold text-indigo-600 text-sm">0</span>
          </div>

          <button
            onClick={() => setVoiceOpen(v => !v)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              voiceOpen ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
            title="Voice Assistant"
          >
            <i className="ri-robot-2-line" />
          </button>

          <button onClick={() => setSettingsOpen(true)} className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <i className="ri-settings-3-line text-gray-600" />
          </button>

          <div className="w-px h-6 bg-gray-200" />

          <div className="flex gap-1.5">
            <button
              onClick={() => setIsMicOn(!isMicOn)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isMicOn ? 'bg-gray-100 hover:bg-gray-200 text-gray-600' : 'bg-red-100 text-red-600'}`}
            >
              <i className={isMicOn ? 'ri-mic-line' : 'ri-mic-off-line'} />
            </button>
            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isVideoOn ? 'bg-gray-100 hover:bg-gray-200 text-gray-600' : 'bg-red-100 text-red-600'}`}
            >
              <i className={isVideoOn ? 'ri-vidicon-line' : 'ri-vidicon-off-line'} />
            </button>
            <button
              onClick={() => setIsScreenSharing(!isScreenSharing)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'}`}
            >
              <i className="ri-computer-line" />
            </button>
          </div>

          <button
            onClick={handleEndMeeting}
            className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
          >
            <i className="ri-phone-line rotate-[135deg]" />
          </button>
        </div>

        {/* Right: Mobile hamburger + key controls */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsMicOn(!isMicOn)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isMicOn ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-600'}`}
          >
            <i className={`text-sm ${isMicOn ? 'ri-mic-line' : 'ri-mic-off-line'}`} />
          </button>
          <button
            onClick={() => setIsVideoOn(!isVideoOn)}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isVideoOn ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-600'}`}
          >
            <i className={`text-sm ${isVideoOn ? 'ri-vidicon-line' : 'ri-vidicon-off-line'}`} />
          </button>
          <button
            onClick={handleEndMeeting}
            className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center"
          >
            <i className="ri-phone-line rotate-[135deg] text-sm" />
          </button>
          <button
            onClick={() => setControlsExpanded(v => !v)}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
          >
            <i className={controlsExpanded ? 'ri-close-line' : 'ri-more-2-fill'} />
          </button>
        </div>
      </nav>

      {/* Mobile: Expanded controls dropdown */}
      {controlsExpanded && isMobile && (
        <div className="md:hidden bg-white border-b border-gray-200 px-3 py-2 flex items-center justify-center gap-2 shrink-0 z-10 animate-slide-down">
          <div
            onClick={() => { setPointsOpen(true); setControlsExpanded(false) }}
            className="flex items-center bg-indigo-50 px-2.5 py-1.5 rounded-full cursor-pointer hover:bg-indigo-100 transition-colors"
          >
            <i className="ri-coins-line text-indigo-600 mr-1 text-sm" />
            <span className="font-semibold text-indigo-600 text-sm">0</span>
          </div>
          <button
            onClick={() => { setVoiceOpen(v => !v); setControlsExpanded(false) }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              voiceOpen ? 'bg-indigo-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
          >
            <i className="ri-robot-2-line text-sm" />
          </button>
          <button
            onClick={() => { setSettingsOpen(true); setControlsExpanded(false) }}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
          >
            <i className="ri-settings-3-line text-gray-600 text-sm" />
          </button>
          <button
            onClick={() => { setIsScreenSharing(!isScreenSharing); setControlsExpanded(false) }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
          >
            <i className="ri-computer-line text-sm" />
          </button>
        </div>
      )}

      {/* ====== MOBILE LAYOUT ====== */}
      {isMobile ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Mobile panel content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {mobilePanel === 'video' && <VideoPanel />}
            {mobilePanel === 'ai' && <AIAssistant />}
            {mobilePanel === 'features' && (
              <div className="flex flex-col h-full overflow-hidden bg-white">
                {/* Feature Tabs - scrollable */}
                <div className="flex border-b border-gray-200 shrink-0 overflow-x-auto bg-gray-50 study-feature-tabs">
                  {featureTabs.map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFeature(tab.id)}
                      className={`flex items-center gap-1 px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                        activeFeature === tab.id
                          ? 'border-indigo-600 text-indigo-600 bg-white'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <i className={`${tab.icon} text-sm sm:text-base`} />
                      <span className="hidden xs:inline">{tab.label}</span>
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  {renderFeatureContent()}
                </div>
              </div>
            )}
          </div>

          {/* Mobile bottom tab bar */}
          <div className="study-mobile-tabbar flex border-t border-gray-200 bg-white shrink-0">
            {mobilePanelTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setMobilePanel(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] sm:text-xs font-medium transition-colors ${
                  mobilePanel === tab.id
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <i className={`${tab.icon} text-lg`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ====== DESKTOP / TABLET LAYOUT ====== */
        <div ref={containerRef} className="flex-1 flex min-h-0 overflow-hidden">
          {/* LEFT HALF: Video + AI Assistant (horizontal split) */}
          <div
            ref={leftPanelRef}
            className="flex flex-col min-w-0 overflow-hidden"
            style={{ width: `${effectiveVSplit}%` }}
          >
            {/* Top: Video Grid */}
            <div className="overflow-hidden" style={{ height: `${horizontalSplit}%` }}>
              <VideoPanel />
            </div>

            {/* Horizontal Resize Handle */}
            <div
              onMouseDown={startHorizontalDrag}
              className="h-1.5 bg-gray-100 hover:bg-indigo-300 cursor-row-resize flex items-center justify-center shrink-0 transition-colors group"
            >
              <div className="w-10 h-0.5 bg-gray-300 rounded-full group-hover:bg-indigo-500 transition-colors" />
            </div>

            {/* Bottom: AI Assistant */}
            <div className="overflow-hidden flex-1">
              <AIAssistant />
            </div>
          </div>

          {/* Vertical Resize Handle */}
          <div
            onMouseDown={startVerticalDrag}
            className="w-1.5 bg-gray-100 hover:bg-indigo-300 cursor-col-resize flex items-center justify-center shrink-0 transition-colors group"
          >
            <div className="h-10 w-0.5 bg-gray-300 rounded-full group-hover:bg-indigo-500 transition-colors" />
          </div>

          {/* RIGHT HALF: AI Features */}
          <div className="flex flex-col min-w-0 overflow-hidden bg-white border-l border-gray-200" style={{ width: `${100 - effectiveVSplit}%` }}>
            {/* Feature Tabs */}
            <div className="flex border-b border-gray-200 shrink-0 overflow-x-auto bg-gray-50 study-feature-tabs">
              {featureTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveFeature(tab.id)}
                  className={`flex items-center gap-1.5 px-3 lg:px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeFeature === tab.id
                      ? 'border-indigo-600 text-indigo-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <i className={`${tab.icon} text-base`} />
                  <span className={isTablet ? 'hidden xl:inline' : ''}>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Feature Content */}
            <div className="flex-1 min-h-0 overflow-hidden">
              {renderFeatureContent()}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <PointsModal isOpen={pointsOpen} onClose={() => setPointsOpen(false)} totalPoints={0} />

      {/* Voice Assistant */}
      <VoiceAssistant isOpen={voiceOpen} onToggle={() => setVoiceOpen(v => !v)} />
    </div>
  )
}
