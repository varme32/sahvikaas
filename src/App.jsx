import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './features/auth/AuthPage'
import DashboardPage from './features/dashboard/DashboardPage'
import RoomsPage from './features/rooms/RoomsPage'
import CreateRoomPage from './features/rooms/CreateRoomPage'
import StudyRoomPage from './features/studyroom/StudyRoomPage'
import ProfilePage from './features/profile/ProfilePage'
import AchievementsPage from './features/achievements/AchievementsPage'
import AIToolsPage from './features/aitools/AIToolsPage'
import ResourcesPage from './features/resources/ResourcesPage'
import SchedulePage from './features/schedule/SchedulePage'
import DashboardLayout from './components/layout/DashboardLayout'
import { ToastProvider } from './components/ui/Toast'
import { AuthProvider, useAuth } from './lib/auth'

// AI Tool Pages
import StudyAssistant from './features/aitools/tools/StudyAssistant'
import QuizGenerator from './features/aitools/tools/QuizGenerator'
import FlashcardGenerator from './features/aitools/tools/FlashcardGenerator'
import NotesSummarizer from './features/aitools/tools/NotesSummarizer'
import GenericTool from './features/aitools/tools/GenericTool'

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
              <Route path="/resources" element={<ResourcesPage />} />
              <Route path="/ai-tools" element={<AIToolsPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/achievements" element={<AchievementsPage />} />
            </Route>
            <Route path="/create-room" element={<ProtectedRoute><CreateRoomPage /></ProtectedRoute>} />
            <Route path="/room/:id" element={<ProtectedRoute><StudyRoomPage /></ProtectedRoute>} />
            
            {/* AI Tool Routes */}
            <Route path="/ai-tools/assistant" element={<ProtectedRoute><StudyAssistant /></ProtectedRoute>} />
            <Route path="/ai-tools/quiz" element={<ProtectedRoute><QuizGenerator /></ProtectedRoute>} />
            <Route path="/ai-tools/flashcards" element={<ProtectedRoute><FlashcardGenerator /></ProtectedRoute>} />
            <Route path="/ai-tools/summarizer" element={<ProtectedRoute><NotesSummarizer /></ProtectedRoute>} />
            <Route path="/ai-tools/tool/:toolId" element={<ProtectedRoute><GenericTool /></ProtectedRoute>} />
            
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
