import { useState, useEffect, useMemo } from 'react'
import { getBadges, getLeaderboard, getStudyActivity, getAchievementStats } from '../../lib/api'

// ─── Circular Progress Component ───
function CircularProgress({ percentage, size = 64, strokeWidth = 5, color }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const [animatedPct, setAnimatedPct] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPct(percentage), 100)
    return () => clearTimeout(timer)
  }, [percentage])

  const offset = circumference - (animatedPct / 100) * circumference

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="#e5e7eb" strokeWidth={strokeWidth} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        stroke={`url(#grad-${color})`} strokeWidth={strokeWidth} fill="none"
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
      />
      <defs>
        <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color === 'indigo' ? '#6366f1' : color === 'amber' ? '#f59e0b' : color === 'teal' ? '#14b8a6' : color === 'pink' ? '#ec4899' : color === 'red' ? '#ef4444' : color === 'yellow' ? '#eab308' : color === 'blue' ? '#3b82f6' : color === 'violet' ? '#8b5cf6' : color === 'orange' ? '#f97316' : '#64748b'} />
          <stop offset="100%" stopColor={color === 'indigo' ? '#a855f7' : color === 'amber' ? '#f97316' : color === 'teal' ? '#10b981' : color === 'pink' ? '#f43f5e' : color === 'red' ? '#f97316' : color === 'yellow' ? '#f59e0b' : color === 'blue' ? '#06b6d4' : color === 'violet' ? '#a855f7' : color === 'orange' ? '#eab308' : '#6366f1'} />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── Badge Card ───
function BadgeCard({ badge }) {
  const pct = Math.round((badge.current / badge.target) * 100)
  const isComplete = pct >= 100
  const colorName = badge.text.split('-')[1] // e.g. 'indigo'

  return (
    <div className={`relative bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group ${isComplete ? 'ring-2 ring-green-400' : ''}`}>
      {isComplete && (
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg animate-bounce-slow">
          <i className="ri-check-line text-white text-sm font-bold" />
        </div>
      )}
      <div className="flex items-start gap-4">
        <div className="relative">
          <CircularProgress percentage={Math.min(pct, 100)} size={64} strokeWidth={5} color={colorName} />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xs font-bold ${badge.text}`}>{pct}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={`w-8 h-8 rounded-lg ${badge.bg} flex items-center justify-center`}>
              <i className={`${badge.icon} ${badge.text}`} />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm truncate">{badge.name}</h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">{badge.desc}</p>
          <div className="space-y-1.5">
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r ${badge.color} transition-all duration-1000 ease-out`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">{badge.current}/{badge.target} {badge.unit}</span>
              {isComplete && <span className="text-xs font-medium text-green-600">Completed!</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Leaderboard Tab ───
function LeaderboardTab({ leaderboardData }) {
  const [filter, setFilter] = useState('all-time')
  const rankColors = ['bg-yellow-400', 'bg-gray-300', 'bg-amber-600']

  if (!leaderboardData || leaderboardData.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No leaderboard data yet. Start studying to appear here!</p>
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {['weekly', 'monthly', 'all-time'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {f.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        {[1, 0, 2].map(idx => {
          const user = leaderboardData[idx]
          const isFirst = idx === 0
          return (
            <div key={user.rank} className={`flex flex-col items-center ${isFirst ? 'order-2 sm:-mt-4' : idx === 1 ? 'order-1' : 'order-3'}`}>
              <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br ${isFirst ? 'from-yellow-400 to-amber-500' : idx === 1 ? 'from-gray-300 to-gray-400' : 'from-amber-600 to-amber-700'} flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-lg`}>
                {user.avatar}
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full ${rankColors[idx]} flex items-center justify-center text-xs font-bold text-white shadow border-2 border-white`}>
                  {user.rank}
                </div>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-gray-900 mt-2 text-center truncate max-w-full">{user.name}</p>
              <p className="text-xs text-indigo-600 font-bold">{user.xp.toLocaleString()} XP</p>
            </div>
          )
        })}
      </div>

      {/* Rest of leaderboard */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase">
          <div className="col-span-1">#</div>
          <div className="col-span-5">Student</div>
          <div className="col-span-2 text-center">Dept</div>
          <div className="col-span-2 text-center">Streak</div>
          <div className="col-span-2 text-right">XP</div>
        </div>
        {leaderboardData.slice(3).map(user => (
          <div key={user.rank} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors items-center">
            <div className="col-span-1 text-sm font-semibold text-gray-400">{user.rank}</div>
            <div className="col-span-5 flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0">
                {user.avatar}
              </div>
              <span className="text-sm font-medium text-gray-900 truncate">{user.name}</span>
            </div>
            <div className="col-span-2 text-center">
              <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{user.dept}</span>
            </div>
            <div className="col-span-2 text-center flex items-center justify-center gap-1">
              <i className="ri-fire-fill text-orange-500 text-xs" />
              <span className="text-xs font-medium text-gray-700">{user.streak}d</span>
            </div>
            <div className="col-span-2 text-right text-sm font-bold text-indigo-600">{user.xp.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Streaks Tab ───
function StreaksTab({ streakData }) {
  // Calculate stats
  const currentStreak = useMemo(() => {
    let streak = 0
    for (let i = streakData.length - 1; i >= 0; i--) {
      if (streakData[i].hours > 0) streak++
      else break
    }
    return streak
  }, [streakData])

  const longestStreak = useMemo(() => {
    let max = 0, current = 0
    for (const d of streakData) {
      if (d.hours > 0) { current++; max = Math.max(max, current) }
      else current = 0
    }
    return max
  }, [streakData])

  const totalHours = useMemo(() => streakData.reduce((s, d) => s + d.hours, 0), [streakData])
  const activeDays = useMemo(() => streakData.filter(d => d.hours > 0).length, [streakData])

  function getHeatColor(hours) {
    if (hours === 0) return 'bg-gray-100'
    if (hours <= 1) return 'bg-green-200'
    if (hours <= 2) return 'bg-green-300'
    if (hours <= 3) return 'bg-green-400'
    return 'bg-green-600'
  }

  // Group data into weeks
  const weeks = useMemo(() => {
    const w = []
    for (let i = 0; i < streakData.length; i += 7) {
      w.push(streakData.slice(i, i + 7))
    }
    return w
  }, [streakData])

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Current Streak', value: `${currentStreak} days`, icon: 'ri-fire-fill', color: 'text-orange-500', bg: 'bg-orange-50' },
          { label: 'Longest Streak', value: `${longestStreak} days`, icon: 'ri-trophy-fill', color: 'text-yellow-500', bg: 'bg-yellow-50' },
          { label: 'Total Hours', value: `${totalHours} hrs`, icon: 'ri-time-fill', color: 'text-blue-500', bg: 'bg-blue-50' },
          { label: 'Active Days', value: `${activeDays}/${streakData.length}`, icon: 'ri-calendar-check-fill', color: 'text-green-500', bg: 'bg-green-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
              <i className={`${stat.icon} text-xl ${stat.color}`} />
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Heatmap */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Study Activity</h3>
        <div className="overflow-x-auto">
          <div className="flex gap-1 min-w-fit">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className={`w-4 h-4 sm:w-5 sm:h-5 rounded-sm ${getHeatColor(day.hours)} cursor-pointer transition-transform hover:scale-125`}
                    title={`${day.date}: ${day.hours}h studied`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <span>Less</span>
            {['bg-gray-100', 'bg-green-200', 'bg-green-300', 'bg-green-400', 'bg-green-600'].map(c => (
              <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      {/* Streak Freeze Info */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-4 sm:p-5 flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <i className="ri-shield-star-line text-xl text-indigo-600" />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 text-sm">Streak Freeze Available</h4>
          <p className="text-xs text-gray-600 mt-0.5">You have <span className="font-bold text-indigo-600">2 streak freezes</span> remaining this week. Missing one day won't break your streak!</p>
        </div>
      </div>
    </div>
  )
}

// ─── Milestones Tab (platform history – kept as static content) ───
function MilestonesTab() {
  return (
    <div className="relative">
      <p className="text-sm text-gray-400 text-center py-8">Platform milestones coming soon.</p>
    </div>
  )
}

// ─── Main Page ───
const tabs = [
  { id: 'badges', label: 'Badges', icon: 'ri-award-line' },
  { id: 'leaderboard', label: 'Leaderboard', icon: 'ri-bar-chart-box-line' },
  { id: 'streaks', label: 'Activity Streaks', icon: 'ri-fire-line' },
  { id: 'milestones', label: 'Milestones', icon: 'ri-flag-line' },
]

export default function AchievementsPage() {
  const [activeTab, setActiveTab] = useState('badges')
  const [loading, setLoading] = useState(true)
  const [badges, setBadges] = useState([])
  const [leaderboardData, setLeaderboardData] = useState([])
  const [streakData, setStreakData] = useState([])
  const [stats, setStats] = useState({ totalXP: 0, currentStreak: 0, longestStreak: 0, rank: '—' })

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const [badgeRes, lbRes, actRes, statRes] = await Promise.all([
          getBadges().catch(() => null),
          getLeaderboard().catch(() => null),
          getStudyActivity().catch(() => null),
          getAchievementStats().catch(() => null),
        ])
        if (!mounted) return
        if (badgeRes?.ok) setBadges(badgeRes.badges || [])
        if (lbRes?.ok) setLeaderboardData(lbRes.leaderboard || [])
        if (actRes?.ok) setStreakData(actRes.activity || [])
        if (statRes?.ok) setStats(statRes.stats || stats)
      } catch { /* ignore */ }
      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [])

  const totalBadges = badges.length
  const completedBadges = badges.filter(b => (b.current || 0) >= b.target).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading achievements...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Achievements</h1>
        <p className="text-sm text-gray-500 mt-1">Track your progress, earn badges, and climb the leaderboard</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total XP', value: (stats.totalXP || 0).toLocaleString(), icon: 'ri-star-fill', color: 'text-yellow-500', bg: 'bg-yellow-50' },
          { label: 'Badges Earned', value: `${completedBadges}/${totalBadges}`, icon: 'ri-award-fill', color: 'text-indigo-500', bg: 'bg-indigo-50' },
          { label: 'Global Rank', value: stats.rank || '—', icon: 'ri-trophy-fill', color: 'text-amber-500', bg: 'bg-amber-50' },
          { label: 'Study Streak', value: `${stats.currentStreak || 0} days`, icon: 'ri-fire-fill', color: 'text-orange-500', bg: 'bg-orange-50' },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <i className={`${stat.icon} ${stat.color}`} />
              </div>
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
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i className={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'badges' && (
          badges.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No badges available yet. Start studying to earn badges!</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {badges.map(badge => <BadgeCard key={badge.id} badge={badge} />)}
            </div>
          )
        )}
        {activeTab === 'leaderboard' && <LeaderboardTab leaderboardData={leaderboardData} />}
        {activeTab === 'streaks' && <StreaksTab streakData={streakData} />}
        {activeTab === 'milestones' && <MilestonesTab />}
      </div>
    </div>
  )
}
