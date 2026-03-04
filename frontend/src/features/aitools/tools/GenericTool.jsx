import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../../../lib/api'

const toolConfigs = {
  'study-planner': {
    name: 'Study Plan Creator',
    icon: 'ri-calendar-todo-line',
    color: 'from-blue-500 to-cyan-500',
    endpoint: '/api/ai/study-plan',
    fields: [
      { name: 'exams', label: 'Upcoming Exams (JSON format)', type: 'textarea', placeholder: '[{"name": "Math Final", "date": "2026-03-15"}]' },
      { name: 'hoursPerDay', label: 'Hours Available Per Day', type: 'number', placeholder: '4' },
      { name: 'subjects', label: 'Subjects (comma-separated)', type: 'text', placeholder: 'Math, Physics, Chemistry' }
    ]
  },
  'doubt-solver': {
    name: 'Doubt Solver',
    icon: 'ri-lightbulb-line',
    color: 'from-yellow-500 to-amber-500',
    endpoint: '/api/ai/doubt-solver',
    fields: [
      { name: 'question', label: 'Your Question', type: 'textarea', placeholder: 'Enter your doubt or question here...' },
      { name: 'subject', label: 'Subject', type: 'text', placeholder: 'e.g., Mathematics, Physics' }
    ]
  },
  'exam-predictor': {
    name: 'Exam Predictor',
    icon: 'ri-bar-chart-grouped-line',
    color: 'from-violet-500 to-purple-500',
    endpoint: '/api/ai/exam-predictor',
    fields: [
      { name: 'subject', label: 'Subject', type: 'text', placeholder: 'e.g., Biology' },
      { name: 'topics', label: 'Topics (comma-separated)', type: 'textarea', placeholder: 'Cell Biology, Genetics, Evolution' },
      { name: 'examType', label: 'Exam Type', type: 'text', placeholder: 'e.g., Midterm, Final' }
    ]
  },
  'assignment-helper': {
    name: 'Assignment Helper',
    icon: 'ri-edit-2-line',
    color: 'from-emerald-500 to-green-500',
    endpoint: '/api/ai/assignment',
    fields: [
      { name: 'topic', label: 'Assignment Topic', type: 'text', placeholder: 'e.g., Climate Change Impact' },
      { name: 'requirements', label: 'Requirements', type: 'textarea', placeholder: 'Describe assignment requirements...' },
      { name: 'wordCount', label: 'Word Count', type: 'number', placeholder: '1000' },
      { name: 'stage', label: 'Stage', type: 'select', options: ['outline', 'draft', 'review'] }
    ]
  },
  'eli5': {
    name: 'Explain Like I\'m 5',
    icon: 'ri-emotion-happy-line',
    color: 'from-orange-500 to-red-500',
    endpoint: '/api/ai/eli5',
    fields: [
      { name: 'topic', label: 'Topic to Explain', type: 'text', placeholder: 'e.g., Quantum Physics, Blockchain' },
      { name: 'complexity', label: 'Complexity Level (1-10)', type: 'range', min: 1, max: 10, default: 5 }
    ]
  },
  'formula-sheet': {
    name: 'Formula Sheet Generator',
    icon: 'ri-functions',
    color: 'from-cyan-500 to-blue-500',
    endpoint: '/api/ai/formula-sheet',
    fields: [
      { name: 'subject', label: 'Subject', type: 'text', placeholder: 'e.g., Physics, Calculus' },
      { name: 'topics', label: 'Topics (comma-separated)', type: 'textarea', placeholder: 'Kinematics, Dynamics, Energy' }
    ]
  },
  'voice-to-text': {
    name: 'Voice Notes to Text',
    icon: 'ri-mic-line',
    color: 'from-rose-500 to-pink-500',
    endpoint: '/api/ai/voice-to-text',
    fields: [
      { name: 'transcript', label: 'Voice Transcript', type: 'textarea', placeholder: 'Paste your voice transcript here...' },
      { name: 'subject', label: 'Subject', type: 'text', placeholder: 'e.g., History Lecture' }
    ]
  },
  'lab-report': {
    name: 'Lab Report Writer',
    icon: 'ri-test-tube-line',
    color: 'from-slate-500 to-gray-600',
    endpoint: '/api/ai/lab-report',
    fields: [
      { name: 'experimentType', label: 'Experiment Type', type: 'text', placeholder: 'e.g., Titration, Pendulum' },
      { name: 'observations', label: 'Observations', type: 'textarea', placeholder: 'Describe what you observed...' },
      { name: 'data', label: 'Data (JSON format)', type: 'textarea', placeholder: '{"trial1": 10.5, "trial2": 10.3}' }
    ]
  }
}

export default function GenericTool() {
  const navigate = useNavigate()
  const { toolId } = useParams()
  const config = toolConfigs[toolId]
  
  const [formData, setFormData] = useState({})
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  if (!config) {
    return <div className="p-6">Tool not found</div>
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      // Process form data
      const processedData = { ...formData }
      
      // Parse JSON fields if needed
      if (formData.exams) {
        try { processedData.exams = JSON.parse(formData.exams) } catch {}
      }
      if (formData.topics && typeof formData.topics === 'string') {
        processedData.topics = formData.topics.split(',').map(t => t.trim())
      }
      if (formData.subjects && typeof formData.subjects === 'string') {
        processedData.subjects = formData.subjects.split(',').map(s => s.trim())
      }
      if (formData.data) {
        try { processedData.data = JSON.parse(formData.data) } catch {}
      }
      
      const res = await apiRequest(config.endpoint, {
        method: 'POST',
        body: processedData
      })
      
      // Extract result from various response formats
      setResult(res.content || res.solution || res.explanation || res.formulaSheet || 
                res.notes || res.report || JSON.stringify(res, null, 2))
    } catch (error) {
      setResult('Error: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => navigate('/ai-tools')} className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50">
            <i className="ri-arrow-left-line text-xl" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
          </div>
          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.color} flex items-center justify-center`}>
            <i className={`${config.icon} text-2xl text-white`} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Input</h2>
            <div className="space-y-4">
              {config.fields.map(field => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{field.label}</label>
                  {field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.name] || ''}
                      onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                      placeholder={field.placeholder}
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={formData[field.name] || field.options[0]}
                      onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-500"
                    >
                      {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : field.type === 'range' ? (
                    <div>
                      <input
                        type="range"
                        value={formData[field.name] || field.default}
                        onChange={e => setFormData({ ...formData, [field.name]: parseInt(e.target.value) })}
                        min={field.min}
                        max={field.max}
                        className="w-full"
                      />
                      <div className="text-center text-sm text-gray-600 mt-1">
                        Level: {formData[field.name] || field.default}
                      </div>
                    </div>
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.name] || ''}
                      onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                  )}
                </div>
              ))}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className={`w-full py-3 rounded-lg bg-gradient-to-r ${config.color} text-white font-medium hover:opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed`}
              >
                {loading ? 'Processing...' : 'Generate'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Result</h2>
            {result ? (
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-700">{result}</div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <i className={`${config.icon} text-5xl mb-3`} />
                <p>Your result will appear here</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
