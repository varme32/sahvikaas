import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './features/auth/AuthPage'
import DashboardPage from './features/dashboard/DashboardPage'
import RoomsPage from './features/rooms/RoomsPage'
import CreateRoomPage from './features/rooms/CreateRoomPage'
import StudyRoomPage from './features/studyroom/StudyRoomPage'
import ProfilePage from './features/profile/ProfilePage'
import DashboardLayout from './components/layout/DashboardLayout'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider, useAuth } from './lib/auth'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    )
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return null
  return isAuthenticated ? <Navigate to="/" replace /> : children
}

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<PublicRoute><AuthPage mode="login" /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><AuthPage mode="signup" /></PublicRoute>} />
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/rooms" element={<RoomsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/resources" element={<PlaceholderPage title="Resources" />} />
              <Route path="/ai-tools" element={<PlaceholderPage title="AI Tools" />} />
              <Route path="/schedule" element={<PlaceholderPage title="Schedule" />} />
              <Route path="/achievements" element={<PlaceholderPage title="Achievements" />} />
            </Route>
            <Route path="/create-room" element={<ProtectedRoute><CreateRoomPage /></ProtectedRoute>} />
            <Route path="/room/:id" element={<ProtectedRoute><StudyRoomPage /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

function PlaceholderPage({ title }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-500 mt-2">This page is coming soon.</p>
      </div>
    </div>
  )
}

export default App
