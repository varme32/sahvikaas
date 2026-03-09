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
import WaitingRoomModal from './components/WaitingRoomModal'
import WaitingScreen from './components/WaitingScreen'

import { getSocket, connectSocket, disconnectSocket } from '../../lib/socket'
import { useAuth } from '../../lib/auth'
import { getRoomInfo } from '../../lib/roomApi'
import { joinRoom, endRoom } from '../../lib/roomApiV2'

const featureTabs = [
  { id: 'chat', label: 'Chat', icon: 'ri-message-3-line' },
  { id: 'notes', label: 'Notes', icon: 'ri-file-text-line' },
  { id: 'pdf', label: 'PDF Summarizer', icon: 'ri-file-pdf-2-line' },
  { id: 'quiz', label: 'Quiz Generator', icon: 'ri-questionnaire-line' },
  { id: 'resources', label: 'Resources', icon: 'ri-folder-line' },
  { id: 'tasks', label: 'Tasks', icon: 'ri-calendar-todo-line' },
]

// Mobile panel tabs. Video stays visible while AI/features open as overlays.
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
  const { user } = useAuth()
  // Use the room ID directly as the meeting ID — no separate meeting ID needed
  const meetingIdFromUrl = id || ''
  const isMobile = useIsMobile()
  const isTablet = useIsTablet()
  // Detect actual mobile device (not just screen size) for camera orientation
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)

  // Room info state
  const [roomInfo, setRoomInfo] = useState({ name: '', subject: '' })
  const [roomInfoLoading, setRoomInfoLoading] = useState(true)
  const [roomInfoError, setRoomInfoError] = useState('')

  // Fetch room info on mount
  useEffect(() => {
    let mounted = true
    async function fetchRoom() {
      setRoomInfoLoading(true)
      setRoomInfoError('')
      try {
        const data = await getRoomInfo(meetingIdFromUrl)
        if (mounted) {
          setRoomInfo({ 
            name: data.name, 
            subject: data.subject,
            owner: data.createdBy?._id || data.createdBy,
            ended: data.ended
          })
          // Don't auto-redirect on data.ended — the room may still be alive
          // in-memory on the server. The socket 'room-ended' event will redirect
          // if the host explicitly ends the room.
        }
      } catch (err) {
        if (mounted) {
          setRoomInfoError('Room not found')
          // Redirect to rooms page after 3 seconds if room not found
          setTimeout(() => {
            navigate('/rooms')
          }, 3000)
        }
      } finally {
        if (mounted) setRoomInfoLoading(false)
      }
    }
    if (meetingIdFromUrl) fetchRoom()
    return () => { mounted = false }
  }, [meetingIdFromUrl, navigate])

  // Use the logged-in user's real name
  const [userName] = useState(() => {
    if (user?.name) {
      sessionStorage.setItem('studyhub-username', user.name)
      return user.name
    }
    const stored = sessionStorage.getItem('studyhub-username')
    if (stored) return stored
    const name = 'User ' + Math.floor(Math.random() * 9000 + 1000)
    sessionStorage.setItem('studyhub-username', name)
    return name
  })

  // Participant count from socket
  const [participantCount, setParticipantCount] = useState(0)
  const [lastParticipantCount, setLastParticipantCount] = useState(0)
  // Points from socket
  const [totalPoints, setTotalPoints] = useState(0)

  // Connect socket when entering the study room, disconnect when leaving
  useEffect(() => {
    connectSocket()

    // Emit join-meeting at page level so the server tracks this socket even if
    // camera/mic access fails in VideoPanel. This ensures disconnect cleanup works.
    const socket = getSocket()
    if (socket && meetingIdFromUrl) {
      const emitJoin = () => {
        socket.emit('join-meeting', { meetingId: meetingIdFromUrl, userName, isMobile: isMobileDevice })
        // Register in MongoDB so this room appears in user's history
        joinRoom(meetingIdFromUrl).catch(() => {})
      }
      if (socket.connected) {
        emitJoin()
      } else {
        socket.once('connect', emitJoin)
      }

      // Re-join room on reconnect (socket gets a new ID after reconnect)
      const handleReconnect = () => {
        console.log('Socket reconnected, re-joining room...')
        socket.emit('join-meeting', { meetingId: meetingIdFromUrl, userName, isMobile: isMobileDevice })
      }
      socket.on('connect', handleReconnect)

      // On page close, disconnect socket.
      const handlePageHide = () => {
        disconnectSocket()
      }

      window.addEventListener('pagehide', handlePageHide)
      window.addEventListener('beforeunload', handlePageHide)

      return () => {
        socket.off('connect', handleReconnect)
        window.removeEventListener('pagehide', handlePageHide)
        window.removeEventListener('beforeunload', handlePageHide)
        disconnectSocket()
      }
    }
  }, [meetingIdFromUrl, userName])

  // Subscribe to socket events for participant count and points
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleParticipants = (list) => {
      setParticipantCount(list.length)
      setLastParticipantCount(list.length)
    }
    const handlePoints = (data) => {
      if (data.userPoints) setTotalPoints(data.userPoints.points || 0)
    }

    socket.on('participants-updated', handleParticipants)
    socket.on('points-updated', handlePoints)

    return () => {
      socket.off('participants-updated', handleParticipants)
      socket.off('points-updated', handlePoints)
    }
  }, [])

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
  const [waitingRoomOpen, setWaitingRoomOpen] = useState(false)

  // Waiting room state
  const [isWaiting, setIsWaiting] = useState(false)
  const [waitingCount, setWaitingCount] = useState(0)

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

  const [hasEnded, setHasEnded] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [endingRoom, setEndingRoom] = useState(false)

  // Detect if current user is host/admin
  useEffect(() => {
    if (roomInfo && user && roomInfo.owner) {
      setIsHost(roomInfo.owner === user._id || roomInfo.owner === user.id || roomInfo.owner === user.email || roomInfo.owner === user.name)
    }
  }, [roomInfo, user])

  // Listen for room-ended socket event and waiting room events
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleRoomEnded = (data) => {
      setHasEnded(true)
      alert(data.message || 'This room has ended.')
      setTimeout(() => {
        navigate('/rooms')
      }, 1000)
    }

    const handleWaitingForApproval = (data) => {
      setIsWaiting(true)
      console.log('Waiting for approval:', data.message)
    }

    const handleJoinApproved = (data) => {
      setIsWaiting(false)
      console.log('Join approved:', data.message)
      // Register in MongoDB so this room appears in user's history
      joinRoom(meetingIdFromUrl).catch(() => {})
      // Re-emit join-meeting so VideoPanel (about to mount) gets existing participants
      const s = getSocket()
      if (s) s.emit('join-meeting', { meetingId: meetingIdFromUrl, userName, isMobile: isMobileDevice })
    }

    const handleJoinDenied = (data) => {
      setIsWaiting(false)
      alert(data.message || 'Your request to join was denied.')
      navigate('/rooms')
    }

    const handleParticipantWaiting = (data) => {
      setWaitingCount(data.waitingList?.length || 0)
      // Show notification for host
      if (isHost && data.participant) {
        // You can add a toast notification here
        console.log(`🔔 ${data.participant.name} is waiting to join`)
        // Auto-open waiting room modal for host
        setWaitingRoomOpen(true)
      }
    }

    const handleWaitingListUpdated = (data) => {
      const count = data.waitingList?.length || 0
      setWaitingCount(count)
      // Auto-close waiting room modal when list is empty
      if (count === 0) setWaitingRoomOpen(false)
    }

    socket.on('room-ended', handleRoomEnded)
    socket.on('waiting-for-approval', handleWaitingForApproval)
    socket.on('join-approved', handleJoinApproved)
    socket.on('join-denied', handleJoinDenied)
    socket.on('participant-waiting', handleParticipantWaiting)
    socket.on('waiting-list-updated', handleWaitingListUpdated)

    return () => {
      socket.off('room-ended', handleRoomEnded)
      socket.off('waiting-for-approval', handleWaitingForApproval)
      socket.off('join-approved', handleJoinApproved)
      socket.off('join-denied', handleJoinDenied)
      socket.off('participant-waiting', handleParticipantWaiting)
      socket.off('waiting-list-updated', handleWaitingListUpdated)
    }
  }, [navigate, isHost])

  // End room (host only)
  const handleEndMeeting = async () => {
    if (!isHost) {
      alert('Only the host can end the room.')
      return
    }
    if (!window.confirm('Are you sure you want to end this room for everyone?')) return
    setEndingRoom(true)
    try {
      const socket = getSocket()
      
      // Try to end via MongoDB API first (if it's a persistent room)
      try {
        await endRoom(meetingIdFromUrl)
      } catch (err) {
        console.log('Room not in MongoDB, ending in-memory room only')
      }
      
      // Emit socket event to end the in-memory room
      if (socket && socket.connected) {
        socket.emit('end-room', { meetingId: meetingIdFromUrl })
      }
      
      setHasEnded(true)
      
      // Navigate back to rooms page after a short delay
      setTimeout(() => {
        disconnectSocket()
        navigate('/rooms')
      }, 1500)
    } catch (err) {
      alert('Failed to end room: ' + (err.message || err))
      setEndingRoom(false)
    }
  }

  const renderFeatureContent = () => {
    switch (activeFeature) {
      case 'chat': return <ChatPanel roomId={meetingIdFromUrl} userName={userName} />
      case 'notes': return <NotesPanel roomId={meetingIdFromUrl} />
      case 'pdf': return <PdfSummarizerPanel />
      case 'quiz': return <QuizGeneratorPanel />
      case 'resources': return <ResourcesPanel roomId={meetingIdFromUrl} />
      case 'tasks': return <TasksPanel roomId={meetingIdFromUrl} />
      default: return <ChatPanel roomId={meetingIdFromUrl} userName={userName} />
    }
  }

  // Show waiting screen if user is waiting for approval
  if (isWaiting) {
    return (
      <WaitingScreen
        roomName={roomInfo.name || 'Study Room'}
        onCancel={() => {
          disconnectSocket()
          navigate('/rooms')
        }}
      />
    )
  }

  // Effective split values (wider left panel on tablet)
  const effectiveVSplit = isTablet ? Math.max(verticalSplit, 45) : verticalSplit

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* Top Navigation Bar */}
      <nav className="study-nav bg-[#F2CF7E] border-b border-[#e0bd6c] px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between shrink-0 z-10 relative">
        {/* Left: User */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/30 flex items-center justify-center">
            <i className="ri-user-line text-lg sm:text-xl text-black" />
          </div>
          <div className="hidden xs:block">
            <h3 className="font-medium text-black text-sm">{userName}</h3>
            <div className="flex items-center gap-1 text-xs text-black/70">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              Online
            </div>
          </div>
        </div>


        {/* Center: Room */}
        <div className="study-nav-center text-center min-w-0">
          {roomInfoLoading ? (
            <h2 className="text-sm sm:text-base font-semibold text-black truncate">Loading...</h2>
          ) : roomInfoError ? (
            <>
              <h2 className="text-sm sm:text-base font-semibold text-red-600 truncate">Room not found</h2>
              <p className="text-xs text-black/70">Redirecting to rooms...</p>
            </>
          ) : hasEnded ? (
            <>
              <h2 className="text-sm sm:text-base font-semibold text-orange-600 truncate">{roomInfo.name || 'Study Room'} (Ended)</h2>
              <p className="text-xs text-black/70">This room has been closed</p>
            </>
          ) : (
            <>
              <h2 className="text-sm sm:text-base font-semibold text-black truncate">{roomInfo.name || 'Study Room'}</h2>
              <p className="text-xs text-black/70 truncate">{roomInfo.subject}</p>
            </>
          )}
          <p className="text-[10px] sm:text-xs text-black/70">
            Room #{id || '—'} · {hasEnded ? `${lastParticipantCount} last online` : `${participantCount} online`}
          </p>
        </div>

        {/* Right: Controls - Desktop */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3 shrink-0">
          <div
            onClick={() => setPointsOpen(true)}
            className="flex items-center bg-white/30 px-2 lg:px-3 py-1.5 rounded-full cursor-pointer hover:bg-white/40 transition-colors"
          >
            <i className="ri-coins-line text-black mr-1 lg:mr-1.5 text-sm" />
            <span className="font-semibold text-black text-sm">{totalPoints}</span>
          </div>

          {/* Waiting Room Button (Host Only) */}
          {isHost && (
            <button
              onClick={() => setWaitingRoomOpen(true)}
              className={`relative w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                waitingCount > 0 ? 'bg-orange-100 text-orange-600 animate-pulse' : 'bg-white/20 hover:bg-white/30 text-black'
              }`}
              title="Waiting Room"
            >
              <i className="ri-user-add-line" />
              {waitingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold animate-bounce">
                  {waitingCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={() => setVoiceOpen(v => !v)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              voiceOpen ? 'bg-white text-black' : 'bg-white/20 hover:bg-white/30 text-black'
            }`}
            title="Voice Assistant"
          >
            <i className="ri-robot-2-line" />
          </button>

          <button onClick={() => setSettingsOpen(true)} className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">
            <i className="ri-settings-3-line text-black" />
          </button>

          <div className="w-px h-6 bg-black/20" />

          <div className="flex gap-1.5">
            <button
              onClick={() => setIsMicOn(!isMicOn)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isMicOn ? 'bg-white/20 hover:bg-white/30 text-black' : 'bg-red-100 text-red-600'}`}
            >
              <i className={isMicOn ? 'ri-mic-line' : 'ri-mic-off-line'} />
            </button>
            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isVideoOn ? 'bg-white/20 hover:bg-white/30 text-black' : 'bg-red-100 text-red-600'}`}
            >
              <i className={isVideoOn ? 'ri-vidicon-line' : 'ri-vidicon-off-line'} />
            </button>
            <button
              onClick={() => setIsScreenSharing(!isScreenSharing)}
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? 'bg-blue-100 text-blue-600' : 'bg-white/20 hover:bg-white/30 text-black'}`}
            >
              <i className="ri-computer-line" />
            </button>
          </div>

          {/* Show End Room only for host, else show Leave Room */}
          {isHost && !hasEnded ? (
            <button
              onClick={handleEndMeeting}
              disabled={endingRoom}
              className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-60"
              title="End Room for Everyone"
            >
              {endingRoom ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-shut-down-line" />}
            </button>
          ) : (
            <button
              onClick={() => {
                // Disconnect socket and navigate
                disconnectSocket()
                navigate('/rooms')
              }}
              className="w-9 h-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
              title="Leave Room"
            >
              <i className="ri-phone-line rotate-[135deg]" />
            </button>
          )}
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
            onClick={() => {
              // Disconnect socket and navigate
              disconnectSocket()
              navigate('/rooms')
            }}
            className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center"
            title="Leave Room"
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
        <div className="md:hidden bg-[#F2CF7E] border-b border-[#e0bd6c] px-3 py-2 flex items-center justify-center gap-2 shrink-0 z-10 animate-slide-down">
          <div
            onClick={() => { setPointsOpen(true); setControlsExpanded(false) }}
            className="flex items-center bg-white/30 px-2.5 py-1.5 rounded-full cursor-pointer hover:bg-white/40 transition-colors"
          >
            <i className="ri-coins-line text-black mr-1 text-sm" />
            <span className="font-semibold text-black text-sm">{totalPoints}</span>
          </div>
          {isHost && (
            <button
              onClick={() => { setWaitingRoomOpen(true); setControlsExpanded(false) }}
              className={`relative w-8 h-8 rounded-full flex items-center justify-center ${
                waitingCount > 0 ? 'bg-orange-100 text-orange-600 animate-pulse' : 'bg-white/20 hover:bg-white/30 text-black'
              }`}
            >
              <i className="ri-user-add-line text-sm" />
              {waitingCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold animate-bounce">
                  {waitingCount}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => { setVoiceOpen(v => !v); setControlsExpanded(false) }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              voiceOpen ? 'bg-white text-black' : 'bg-white/20 hover:bg-white/30 text-black'
            }`}
          >
            <i className="ri-robot-2-line text-sm" />
          </button>
          <button
            onClick={() => { setSettingsOpen(true); setControlsExpanded(false) }}
            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30"
          >
            <i className="ri-settings-3-line text-black text-sm" />
          </button>
          <button
            onClick={() => { setIsScreenSharing(!isScreenSharing); setControlsExpanded(false) }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? 'bg-blue-100 text-blue-600' : 'bg-white/20 text-black'}`}
          >
            <i className="ri-computer-line text-sm" />
          </button>
        </div>
      )}

      {/* ====== MOBILE LAYOUT ====== */}
      {isMobile ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Mobile panel content */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            <VideoPanel meetingId={meetingIdFromUrl} isMicOn={isMicOn} isVideoOn={isVideoOn} isScreenSharing={isScreenSharing} onScreenShareChange={setIsScreenSharing} userName={userName} />

            {mobilePanel !== 'video' && (
              <div className="absolute inset-x-0 bottom-0 top-[20%] z-20 bg-white border-t border-gray-200 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
                  <h3 className="text-sm font-semibold text-gray-800">
                    {mobilePanel === 'ai' ? 'AI Assistant' : 'Additional Features'}
                  </h3>
                  <button
                    onClick={() => setMobilePanel('video')}
                    className="w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-600 flex items-center justify-center"
                    aria-label="Close panel"
                  >
                    <i className="ri-close-line" />
                  </button>
                </div>

                {mobilePanel === 'ai' ? (
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <AIAssistant />
                  </div>
                ) : (
                  <div className="flex flex-col h-full overflow-hidden bg-white">
                    {/* Feature Tabs - scrollable */}
                    <div className="flex border-b border-gray-200 shrink-0 overflow-x-auto bg-gray-50 study-feature-tabs">
                      {featureTabs.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setActiveFeature(tab.id)}
                          className={`flex items-center gap-1 px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors border-b-2 ${
                            activeFeature === tab.id
                              ? 'border-[#F2CF7E] text-black bg-white'
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
                    ? 'text-black bg-[#F2CF7E]/10'
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
              <VideoPanel meetingId={meetingIdFromUrl} isMicOn={isMicOn} isVideoOn={isVideoOn} isScreenSharing={isScreenSharing} onScreenShareChange={setIsScreenSharing} userName={userName} />
            </div>

            {/* Horizontal Resize Handle */}
            <div
              onMouseDown={startHorizontalDrag}
              className="h-1.5 bg-gray-100 hover:bg-[#F2CF7E]/50 cursor-row-resize flex items-center justify-center shrink-0 transition-colors group"
            >
              <div className="w-10 h-0.5 bg-gray-300 rounded-full group-hover:bg-[#F2CF7E]/100 transition-colors" />
            </div>

            {/* Bottom: AI Assistant */}
            <div className="overflow-hidden flex-1">
              <AIAssistant />
            </div>
          </div>

          {/* Vertical Resize Handle */}
          <div
            onMouseDown={startVerticalDrag}
            className="w-1.5 bg-gray-100 hover:bg-[#F2CF7E]/50 cursor-col-resize flex items-center justify-center shrink-0 transition-colors group"
          >
            <div className="h-10 w-0.5 bg-gray-300 rounded-full group-hover:bg-[#F2CF7E]/100 transition-colors" />
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
                      ? 'border-[#F2CF7E] text-black bg-white'
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
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} roomId={meetingIdFromUrl} />
      <PointsModal isOpen={pointsOpen} onClose={() => setPointsOpen(false)} roomId={meetingIdFromUrl} userName={userName} />
      <WaitingRoomModal isOpen={waitingRoomOpen} onClose={() => setWaitingRoomOpen(false)} roomId={meetingIdFromUrl} />

      {/* Voice Assistant */}
      <VoiceAssistant isOpen={voiceOpen} onToggle={() => setVoiceOpen(v => !v)} />
    </div>
  )
}

