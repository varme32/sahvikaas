import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

// ─── AI Tools Data ───
const aiTools = [
  {
    id: 'assistant',
    name: 'Study Assistant',
    desc: 'Get instant help with any topic. Ask questions, get explanations, and learn concepts faster.',
    icon: 'ri-chat-smile-2-line',
    color: 'from-indigo-500 to-purple-500',
    bg: 'bg-indigo-50',
    text: 'text-indigo-600',
    action: 'Start Conversation',
    category: 'learn',
    route: '/ai-tools/assistant',
  },
  {
    id: 'quiz',
    name: 'Quiz Generator',
    desc: 'Create custom practice tests from any topic. Choose difficulty, number of questions, and format.',
    icon: 'ri-question-answer-line',
    color: 'from-teal-500 to-emerald-500',
    bg: 'bg-teal-50',
    text: 'text-teal-600',
    action: 'Generate Quiz',
    category: 'practice',
    route: '/ai-tools/quiz',
  },
  {
    id: 'planner',
    name: 'Study Plan Creator',
    desc: 'AI generates a personalized weekly study plan based on your exams and available hours.',
    icon: 'ri-calendar-todo-line',
    color: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    action: 'Create Plan',
    category: 'organize',
    route: '/ai-tools/tool/study-planner',
  },
  {
    id: 'summarizer',
    name: 'Notes Summarizer',
    desc: 'Paste or upload your notes and get a concise summary with highlighted key terms.',
    icon: 'ri-file-text-line',
    color: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    action: 'Summarize Notes',
    category: 'learn',
    route: '/ai-tools/summarizer',
  },
  {
    id: 'flashcards',
    name: 'Flashcard Generator',
    desc: 'Auto-create flashcards from any content. Flip-card UI with spaced repetition learning.',
    icon: 'ri-stack-line',
    color: 'from-pink-500 to-rose-500',
    bg: 'bg-pink-50',
    text: 'text-pink-600',
    action: 'Create Flashcards',
    category: 'practice',
    route: '/ai-tools/flashcards',
  },
  {
    id: 'doubts',
    name: 'Doubt Solver',
    desc: 'Ask any academic doubt and get step-by-step solutions with visual explanations.',
    icon: 'ri-lightbulb-line',
    color: 'from-yellow-500 to-amber-500',
    bg: 'bg-yellow-50',
    text: 'text-yellow-600',
    action: 'Ask Doubt',
    category: 'learn',
    route: '/ai-tools/tool/doubt-solver',
  },
  {
    id: 'predictor',
    name: 'Exam Predictor',
    desc: 'Predict important questions from past papers using AI pattern analysis.',
    icon: 'ri-bar-chart-grouped-line',
    color: 'from-violet-500 to-purple-500',
    bg: 'bg-violet-50',
    text: 'text-violet-600',
    action: 'Predict Questions',
    category: 'practice',
    route: '/ai-tools/tool/exam-predictor',
  },
  {
    id: 'essay',
    name: 'Assignment Helper',
    desc: 'Structure and draft assignments with AI. Outline → Draft → Review workflow.',
    icon: 'ri-edit-2-line',
    color: 'from-emerald-500 to-green-500',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    action: 'Start Writing',
    category: 'create',
    route: '/ai-tools/tool/assignment-helper',
  },
  {
    id: 'eli5',
    name: 'Explain Like I\'m 5',
    desc: 'Simplify complex topics into easy language. Adjust the complexity level with a slider.',
    icon: 'ri-emotion-happy-line',
    color: 'from-orange-500 to-red-500',
    bg: 'bg-orange-50',
    text: 'text-orange-600',
    action: 'Simplify Topic',
    category: 'learn',
    route: '/ai-tools/tool/eli5',
  },
  {
    id: 'formulas',
    name: 'Formula Sheet Generator',
    desc: 'Generate comprehensive formula sheets for any subject. Printable & downloadable.',
    icon: 'ri-functions',
    color: 'from-cyan-500 to-blue-500',
    bg: 'bg-cyan-50',
    text: 'text-cyan-600',
    action: 'Generate Sheet',
    category: 'create',
    route: '/ai-tools/tool/formula-sheet',
  },
  {
    id: 'voice',
    name: 'Voice Notes to Text',
    desc: 'Convert recorded lectures to formatted text notes. Upload audio and get organized notes.',
    icon: 'ri-mic-line',
    color: 'from-rose-500 to-pink-500',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    action: 'Convert Audio',
    category: 'create',
    route: '/ai-tools/tool/voice-to-text',
  },
  {
    id: 'lab',
    name: 'Lab Report Writer',
    desc: 'Generate lab report templates with AI. Pre-filled structure per experiment type.',
    icon: 'ri-test-tube-line',
    color: 'from-slate-500 to-gray-600',
    bg: 'bg-slate-50',
    text: 'text-slate-600',
    action: 'Write Report',
    category: 'create',
    route: '/ai-tools/tool/lab-report',
  },
]

const categories = [
  { id: 'all', label: 'All Tools', icon: 'ri-apps-line' },
  { id: 'learn', label: 'Learn', icon: 'ri-book-read-line' },
  { id: 'practice', label: 'Practice', icon: 'ri-pencil-ruler-2-line' },
  { id: 'create', label: 'Create', icon: 'ri-magic-line' },
  { id: 'organize', label: 'Organize', icon: 'ri-layout-grid-line' },
]



// ─── Tool Card ───
function ToolCard({ tool, onLaunch }) {
  const navigate = useNavigate()
  
  return (
    <div className="group bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${tool.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
        <i className={`${tool.icon} text-2xl text-white`} />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{tool.name}</h3>
      <p className="text-sm text-gray-500 mb-4 line-clamp-2">{tool.desc}</p>
      <button
        onClick={() => navigate(tool.route)}
        className={`w-full py-2.5 rounded-lg text-sm font-medium bg-gradient-to-r ${tool.color} text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}
      >
        <i className="ri-play-circle-line" />
        {tool.action}
      </button>
    </div>
  )
}

// ─── Main Page ───
export default function AIToolsPage() {
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')

  const filteredTools = aiTools.filter(tool => {
    const matchesCategory = activeCategory === 'all' || tool.category === activeCategory
    const matchesSearch = tool.name.toLowerCase().includes(search.toLowerCase()) ||
                          tool.desc.toLowerCase().includes(search.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">AI Tools</h1>
        <p className="text-sm text-gray-500 mt-1">Your AI-powered study toolkit for smarter learning</p>
      </div>

      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-6 sm:p-8 text-white">
        <div className="relative z-10">
          <h2 className="text-lg sm:text-2xl font-bold mb-2">Supercharge Your Studies with AI</h2>
          <p className="text-sm sm:text-base text-white/80 max-w-lg">
            12 powerful AI tools designed to help you learn faster, practice smarter, and create better study materials.
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute top-1/2 right-1/4 w-16 h-16 rounded-full bg-white/5" />
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6">
        <h3 className="font-semibold text-gray-900 mb-4 text-center">How It Works</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { step: '1', title: 'Choose a Tool', desc: 'Pick from 12 AI-powered tools', icon: 'ri-cursor-line', color: 'from-indigo-500 to-purple-500' },
            { step: '2', title: 'Provide Input', desc: 'Enter your topic, question, or content', icon: 'ri-keyboard-line', color: 'from-teal-500 to-emerald-500' },
            { step: '3', title: 'Get Results', desc: 'Receive AI-generated study materials', icon: 'ri-sparkle-line', color: 'from-amber-500 to-orange-500' },
          ].map(s => (
            <div key={s.step} className="flex flex-col items-center text-center p-4">
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
                <i className={`${s.icon} text-xl text-white`} />
              </div>
              <div className="text-xs font-bold text-indigo-600 mb-1">STEP {s.step}</div>
              <h4 className="font-semibold text-gray-900 text-sm">{s.title}</h4>
              <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search AI tools..."
            className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto study-feature-tabs">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                activeCategory === cat.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className={cat.icon} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map(tool => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>

      {filteredTools.length === 0 && (
        <div className="text-center py-12">
          <i className="ri-search-line text-4xl text-gray-300" />
          <p className="text-gray-500 mt-2">No tools found matching your search.</p>
        </div>
      )}
    </div>
  )
}
