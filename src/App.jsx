import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import RoomsPage from './pages/RoomsPage'
import CreateRoomPage from './pages/CreateRoomPage'
import StudyRoomPage from './pages/StudyRoomPage'
import DashboardLayout from './components/layout/DashboardLayout'
import { ToastProvider } from './components/ui/Toast'

function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="/resources" element={<PlaceholderPage title="Resources" />} />
            <Route path="/ai-tools" element={<PlaceholderPage title="AI Tools" />} />
            <Route path="/schedule" element={<PlaceholderPage title="Schedule" />} />
            <Route path="/achievements" element={<PlaceholderPage title="Achievements" />} />
            <Route path="/profile" element={<PlaceholderPage title="Profile" />} />
          </Route>
          <Route path="/create-room" element={<CreateRoomPage />} />
          <Route path="/room/:id" element={<StudyRoomPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ToastProvider>
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
