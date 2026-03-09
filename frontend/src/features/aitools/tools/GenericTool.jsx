import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { apiRequest } from '../../../lib/api'

const toolConfigs = {
  'study-planner': {
    name: 'Study Plan Creator',
    icon: 'ri-calendar-todo-line',
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
    endpoint: '/api/ai/doubt-solver',
    fields: [
      { name: 'question', label: 'Your Question', type: 'textarea', placeholder: 'Enter your doubt or question here...' },
      { name: 'subject', label: 'Subject', type: 'text', placeholder: 'e.g., Mathematics, Physics' }
    ]
  },
  'exam-predictor': {
    name: 'Exam Predictor',
    icon: 'ri-bar-chart-grouped-line',
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
    endpoint: '/api/ai/eli5',
    fields: [
      { name: 'topic', label: 'Topic to Explain', type: 'text', placeholder: 'e.g., Quantum Physics, Blockchain' },
      { name: 'complexity', label: 'Complexity Level (1-10)', type: 'range', min: 1, max: 10, default: 5 }
    ]
  },
  'formula-sheet': {
    name: 'Formula Sheet Generator',
    icon: 'ri-functions',
    endpoint: '/api/ai/formula-sheet',
    fields: [
      { name: 'subject', label: 'Subject', type: 'text', placeholder: 'e.g., Physics, Calculus' },
      { name: 'topics', label: 'Topics (comma-separated)', type: 'textarea', placeholder: 'Kinematics, Dynamics, Energy' }
    ]
  },
  'voice-to-text': {
    name: 'Voice Notes to Text',
    icon: 'ri-mic-line',
    endpoint: '/api/ai/voice-to-text',
    fields: [
      { name: 'transcript', label: 'Voice Transcript', type: 'textarea', placeholder: 'Paste your voice transcript here...' },
      { name: 'subject', label: 'Subject', type: 'text', placeholder: 'e.g., History Lecture' }
    ]
  },
  'lab-report': {
    name: 'Lab Report Writer',
    icon: 'ri-test-tube-line',
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <i className="ri-error-warning-line text-5xl text-gray-400 mb-4" />
          <p className="text-gray-600">Tool not found</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const processedData = { ...formData }
      
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
      
      setResult(res.content || res.solution || res.explanation || res.formulaSheet || 
                res.notes || res.report || JSON.stringify(res, null, 2))
    } catch (error) {
      setResult('Error: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Header Section - Full Width */}
      <div className="bg-[#F2CF7E] border-y border-[#e0bd6c] py-6 -mx-3 sm:-mx-4 md:-mx-6 px-3 sm:px-4 md:px-6 shadow-sm">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <button onClick={() => navigate('/ai-tools')} className="w-10 h-10 rounded-lg bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors">
            <i className="ri-arrow-left-line text-xl text-black" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-black">{config.name}</h1>
            <p className="text-sm text-black/80 mt-1">AI-powered tool for your studies</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-black/10 flex items-center justify-center">
            <i className={`${config.icon} text-xl text-black`} />
          </div>
        </div>
      </div>

      {/* Main Content - Centered */}
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              <div className="p-6 sm:p-8 space-y-8">
                <div className="space-y-6">
                  <div className="pb-3 border-b-2 border-[#F2CF7E]">
                    <h2 className="text-lg font-bold text-gray-900">Input</h2>
                  </div>

                  {config.fields.map(field => (
                    <div key={field.name}>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">
                        {field.label}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          value={formData[field.name] || ''}
                          onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                          placeholder={field.placeholder}
                          rows={4}
                          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors resize-none"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={formData[field.name] || field.options[0]}
                          onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                          className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
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
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#F2CF7E]"
                          />
                          <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>Level {field.min}</span>
                            <span className="font-bold text-gray-900">Level: {formData[field.name] || field.default}</span>
                            <span>Level {field.max}</span>
                          </div>
                        </div>
                      ) : (
                        <input
                          type={field.type}
                          value={formData[field.name] || ''}
                          onChange={e => setFormData({ ...formData, [field.name]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full h-12 px-4 rounded-lg border-2 border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-[#F2CF7E] focus:ring-0 transition-colors"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Footer */}
              <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/ai-tools')}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-white hover:border-gray-400 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <>
                      <i className="ri-loader-4-line animate-spin text-lg" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="ri-sparkling-line text-lg" />
                      Generate
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Output Section */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="pb-3 border-b-2 border-[#F2CF7E]">
                <h2 className="text-lg font-bold text-gray-900">Result</h2>
              </div>

              {result ? (
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">{result}</div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
                  <div className="w-20 h-20 rounded-full bg-[#F2CF7E]/20 flex items-center justify-center mb-4">
                    <i className={`${config.icon} text-4xl text-[#F2CF7E]`} />
                  </div>
                  <p className="text-sm font-medium">Your result will appear here</p>
                  <p className="text-xs text-gray-400 mt-1">Fill in the form and click Generate</p>
                </div>
              )}
            </div>

            {result && (
              <div className="px-6 sm:px-8 py-6 bg-gradient-to-r from-[#F2CF7E]/10 to-[#F2CF7E]/5 border-t-2 border-[#F2CF7E] flex items-center justify-end gap-3">
                <button
                  onClick={() => navigator.clipboard.writeText(result)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-white hover:border-gray-400 transition-colors flex items-center gap-2"
                >
                  <i className="ri-file-copy-line" />
                  Copy
                </button>
                <button
                  onClick={() => setResult('')}
                  className="px-6 py-3 bg-[#F2CF7E] text-black font-bold rounded-lg hover:bg-[#e0bd6c] transition-colors flex items-center gap-2 shadow-md"
                >
                  <i className="ri-refresh-line" />
                  New Result
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
