import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { listMeetings, getAchievementStats } from '../../lib/api'

export default function ProfilePage() {
  const { user, updateProfile, logout } = useAuth()
  const navigate = useNavigate()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: user?.name || '',
    bio: user?.bio || '',
    institution: user?.institution || '',
    major: user?.major || '',
  })
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [myRooms, setMyRooms] = useState([])
  const [stats, setStats] = useState({ totalStudyHours: 0, totalXP: 0, currentStreak: 0 })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      const [roomsRes, statsRes] = await Promise.all([
        listMeetings().catch(() => null),
        getAchievementStats().catch(() => null),
      ])
      if (!mounted) return
      if (roomsRes?.rooms) setMyRooms(roomsRes.rooms)
      if (statsRes?.ok) setStats(statsRes.stats || stats)
    }
    load()
    return () => { mounted = false }
  }, [])

  const handleSave = async () => {
    setError('')
    if (!form.name.trim()) {
      setError('Name is required.')
      return
    }
    try {
      const result = await updateProfile({
        name: form.name.trim(),
        bio: form.bio.trim(),
        institution: form.institution.trim(),
        major: form.major.trim(),
      })
      if (!result.ok) {
        setError(result.error || 'Failed to save profile.')
        return
      }
      setSaved(true)
      setEditing(false)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Something went wrong. Please try again.')
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user) return null

  const initials = user.name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Success banner */}
      {saved && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2 animate-slide-down">
          <i className="ri-check-line text-lg" />
          Profile updated successfully!
        </div>
      )}

      {/* Profile Header Card */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {/* Gradient banner */}
        <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600 relative">
          <div className="absolute -bottom-12 left-6">
            <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-lg flex items-center justify-center">
              <span className="text-2xl font-bold text-indigo-600">{initials}</span>
            </div>
          </div>
        </div>

        <div className="pt-14 pb-6 px-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
              <p className="text-sm text-gray-500">{user.email}</p>
              {user.institution && (
                <p className="text-sm text-gray-500 mt-0.5">
                  <i className="ri-building-line mr-1" />
                  {user.institution}
                  {user.major && ` · ${user.major}`}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(!editing)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-1.5"
              >
                <i className={editing ? 'ri-close-line' : 'ri-pencil-line'} />
                {editing ? 'Cancel' : 'Edit Profile'}
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors flex items-center gap-1.5"
              >
                <i className="ri-logout-box-line" />
                Logout
              </button>
            </div>
          </div>
          {user.bio && !editing && (
            <p className="mt-3 text-sm text-gray-600">{user.bio}</p>
          )}
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 space-y-5">
          <h2 className="text-lg font-semibold text-gray-900">Edit Profile</h2>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <i className="ri-error-warning-line" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full h-11 px-4 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full h-11 px-4 rounded-lg border border-gray-200 text-sm bg-gray-50 text-gray-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Institution</label>
              <input
                type="text"
                placeholder="e.g. MIT, Stanford"
                value={form.institution}
                onChange={e => setForm(p => ({ ...p, institution: e.target.value }))}
                className="w-full h-11 px-4 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Major / Field</label>
              <input
                type="text"
                placeholder="e.g. Computer Science"
                value={form.major}
                onChange={e => setForm(p => ({ ...p, major: e.target.value }))}
                className="w-full h-11 px-4 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio</label>
            <textarea
              rows={3}
              placeholder="Tell others about yourself..."
              value={form.bio}
              onChange={e => setForm(p => ({ ...p, bio: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSave}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-1.5"
            >
              <i className="ri-save-line" />
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Rooms Created', value: myRooms.length, icon: 'ri-video-chat-line', color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Member Since', value: new Date(user.joinedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), icon: 'ri-calendar-line', color: 'text-green-600 bg-green-50' },
          { label: 'Study Hours', value: stats.totalStudyHours || 0, icon: 'ri-time-line', color: 'text-orange-600 bg-orange-50' },
          { label: 'Total XP', value: (stats.totalXP || 0).toLocaleString(), icon: 'ri-trophy-line', color: 'text-purple-600 bg-purple-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-gray-200 rounded-lg p-4 text-center">
            <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center mx-auto mb-2`}>
              <i className={`${stat.icon} text-lg`} />
            </div>
            <p className="text-lg font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* My Rooms */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">My Rooms</h2>
          <button
            onClick={() => navigate('/create-room')}
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
          >
            <i className="ri-add-line" />
            Create Room
          </button>
        </div>
        {myRooms.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <i className="ri-video-chat-line text-2xl text-gray-400" />
            </div>
            <p className="text-sm text-gray-500">You haven't created any rooms yet.</p>
            <button
              onClick={() => navigate('/create-room')}
              className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create Your First Room
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {myRooms.map(room => (
              <div key={room.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-gray-900">{room.name}</p>
                  <p className="text-xs text-gray-500">{room.subject} · Created {new Date(room.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${room.privacy === 'private' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {room.privacy}
                  </span>
                  <button
                    onClick={() => navigate(`/room/${room.id}`)}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Enter
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
