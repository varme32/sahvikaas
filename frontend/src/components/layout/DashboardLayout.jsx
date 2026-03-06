import { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { apiRequest } from '../../lib/api'

const navItems = [
  { path: '/', label: 'Dashboard', icon: 'ri-dashboard-line' },
  { path: '/rooms', label: 'Study Rooms', icon: 'ri-video-chat-line' },
  { path: '/resources', label: 'Resources', icon: 'ri-folder-line' },
  { path: '/ai-tools', label: 'AI Tools', icon: 'ri-robot-line' },
  { path: '/schedule', label: 'Schedule', icon: 'ri-calendar-line' },
  { path: '/achievements', label: 'Achievements', icon: 'ri-trophy-line' },
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

export default function DashboardLayout() {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuth()
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notifRef = useRef(null)

  // Close sidebar on route change in mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false)
  }, [isMobile])

  // Fetch unread notification count
  useEffect(() => {
    if (!user) return
    const fetchCount = () => {
      apiRequest('/api/notifications/unread-count', { method: 'GET' })
        .then(data => { if (data.ok) setUnreadCount(data.count) })
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [user])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggleNotifications = async () => {
    if (!notifOpen) {
      try {
        const data = await apiRequest('/api/notifications', { method: 'GET' })
        if (data.ok) setNotifications(data.notifications || [])
      } catch {}
    }
    setNotifOpen(!notifOpen)
  }

  const markAllRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'PUT' })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {}
  }

  return (
    <div className="flex h-screen bg-[#eeeeee]">
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isMobile
            ? `fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : 'w-64 shrink-0'
          }
          bg-[#F2CF7E] border-r border-[#e0bd6c] flex flex-col
        `}
      >
        <div className="p-4 sm:p-6 flex items-center justify-between">
          <h1
            className="logo-font text-2xl text-black cursor-pointer"
            onClick={() => { navigate('/'); setSidebarOpen(false) }}
          >
            StudyHub
          </h1>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[#e0bd6c] transition-colors"
            >
              <i className="ri-close-line text-xl text-black" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => isMobile && setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-black shadow-sm'
                    : 'text-black/80 hover:bg-[#e0bd6c] hover:text-black'
                }`
              }
            >
              <i className={`${item.icon} text-lg`} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-[#e0bd6c]">
          <button
            onClick={() => { navigate('/profile'); setSidebarOpen(false) }}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-[#e0bd6c] transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-black">
                  {user?.name ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : 'U'}
                </span>
              )}
            </div>
            <div className="text-left min-w-0 flex-1">
              <p className="text-sm font-medium text-black truncate">{user?.name || 'Guest'}</p>
              <p className="text-xs text-black/70 truncate">{user?.major || user?.email || ''}</p>
            </div>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-14 sm:h-16 bg-white border-b border-gray-100 flex items-center justify-between px-3 sm:px-6 shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors shrink-0"
              >
                <i className="ri-menu-line text-xl text-gray-700" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <div className="relative" ref={notifRef}>
              <button
                onClick={toggleNotifications}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors relative"
              >
                <i className="ri-notification-3-line text-lg sm:text-xl text-gray-700" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 sm:top-1.5 right-1 sm:right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-[#F2CF7E] text-black text-[10px] font-bold rounded-full px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-gray-100 shadow-xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between p-3 border-b border-gray-100">
                    <h4 className="text-sm font-semibold text-black">Notifications</h4>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-[#F2CF7E] hover:text-[#e0bd6c] font-medium transition-colors">
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">No notifications</p>
                    ) : (
                      notifications.slice(0, 15).map(n => (
                        <div
                          key={n._id}
                          onClick={() => {
                            if (n.roomId) { navigate(`/room/${n.roomId}`); setNotifOpen(false) }
                          }}
                          className={`px-3 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!n.read ? 'bg-[#F2CF7E]/5' : ''}`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!n.read ? 'bg-[#F2CF7E]/20' : 'bg-gray-100'}`}>
                              <i className={`ri-team-line text-sm ${!n.read ? 'text-[#F2CF7E]' : 'text-gray-600'}`} />
                            </div>
                            <div className="min-w-0">
                              <p className={`text-sm ${!n.read ? 'font-medium text-black' : 'text-gray-700'}`}>{n.message || n.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{new Date(n.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <button className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
              <i className="ri-settings-3-line text-lg sm:text-xl text-gray-700" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
