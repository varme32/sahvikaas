import express from 'express'
import multer from 'multer'
import pdfParse from 'pdf-parse'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// OpenRouter API configuration
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001'

// Call OpenRouter API (OpenAI-compatible)
async function callAI(messages, options = {}) {
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model || OPENROUTER_MODEL,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    const err = new Error(error.error?.message || `API error: ${response.status}`)
    err.status = response.status
    throw err
  }

  const data = await response.json()
  return data.choices[0].message.content
}

// Retry helper for 429 rate limit errors
async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const is429 = err.status === 429 || err.message?.includes('429')
      if (!is429 || attempt === maxRetries) throw err
      const match = err.message?.match(/retry in ([\d.]+)s/)
      const delay = match ? Math.ceil(parseFloat(match[1]) * 1000) : (2 ** attempt) * 2000
      await new Promise(r => setTimeout(r, Math.min(delay, 60000)))
    }
  }
}

function handleAIError(error, res, action = 'get AI response') {
  console.error(`${action} error:`, error)
  const is429 = error.status === 429 || error.message?.includes('429')
  if (is429) {
    return res.status(429).json({
      error: 'AI quota limit reached. Please wait a minute and try again, or try later today.',
      retryable: true
    })
  }
  res.status(500).json({ error: `Failed to ${action}`, details: error.message })
}

// ─── Study Assistant ───
router.post('/assistant', async (req, res) => {
  try {
    const { message, history = [] } = req.body
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }
    
    // Build messages array from history
    const messages = history
      .filter(h => h.content && h.content.trim())
      .map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.content
      }))
    
    messages.push({ role: 'user', content: message })
    
    const response = await withRetry(() => callAI(messages, { maxTokens: 1000 }))
    res.json({ success: true, response })
  } catch (error) {
    handleAIError(error, res, 'get AI response')
  }
})

// ─── Quiz Generator ───
router.post('/quiz', upload.single('pdf'), async (req, res) => {
  try {
    const { topic, numQuestions = 10, difficulty = 'medium' } = req.body
    let content = topic
    
    if (req.file) {
      const pdfData = await pdfParse(req.file.buffer)
      content = pdfData.text.substring(0, 5000)
    }
    
    const prompt = `Generate ${numQuestions} ${difficulty} difficulty multiple-choice questions about: ${content}

Format as JSON array:
[{
  "question": "Question text",
  "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
  "correct": 0,
  "explanation": "Why this is correct"
}]`
    
    const text = await withRetry(() => callAI([{ role: 'user', content: prompt }]))
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    
    res.json({ success: true, questions })
  } catch (error) {
    handleAIError(error, res, 'generate quiz')
  }
})

// ─── Study Plan Creator ───
router.post('/study-plan', async (req, res) => {
  try {
    const { exams, hoursPerDay, subjects } = req.body
    
    const prompt = `Create a detailed weekly study plan:
- Exams: ${JSON.stringify(exams)}
- Available hours per day: ${hoursPerDay}
- Subjects: ${subjects.join(', ')}

Format as JSON:
{
  "plan": [
    {"day": "Monday", "tasks": [{"time": "9-11 AM", "subject": "Math", "topic": "Calculus", "duration": "2h"}]}
  ],
  "tips": ["tip1", "tip2"]
}`
    
    const text = await withRetry(() => callAI([{ role: 'user', content: prompt }]))
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { plan: [], tips: [] }
    
    res.json({ success: true, ...plan })
  } catch (error) {
    handleAIError(error, res, 'create study plan')
  }
})

// ─── Notes Summarizer ───
router.post('/summarize', upload.single('pdf'), async (req, res) => {
  try {
    const { notes } = req.body
    let content = notes
    
    if (req.file) {
      const pdfData = await pdfParse(req.file.buffer)
      content = pdfData.text
    }
    
    const prompt = `Summarize these notes concisely with key points and important terms highlighted:

${content.substring(0, 10000)}

Format:
## Summary
[Brief overview]

## Key Points
- Point 1
- Point 2

## Important Terms
- Term: Definition`
    
    const summary = await withRetry(() => callAI([{ role: 'user', content: prompt }]))
    
    res.json({ success: true, summary })
  } catch (error) {
    handleAIError(error, res, 'summarize notes')
  }
})

// ─── Flashcard Generator ───
router.post('/flashcards', async (req, res) => {
  try {
    const { topic, content, count = 10 } = req.body
    
    const prompt = `Generate ${count} flashcards for: ${topic}
${content ? `Content: ${content.substring(0, 3000)}` : ''}

Format as JSON array:
[{
  "front": "Question or term",
  "back": "Answer or definition",
  "category": "subtopic"
}]`
    
    const text = await withRetry(() => callAI([{ role: 'user', content: prompt }]))
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const flashcards = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    
    res.json({ success: true, flashcards })
  } catch (error) {
    handleAIError(error, res, 'generate flashcards')
  }
})

// ─── Doubt Solver ───
router.post('/doubt-solver', async (req, res) => {
  try {
    const { question, subject } = req.body
    
    const prompt = `Solve this ${subject} question with step-by-step explanation:

${question}

Provide:
1. Clear step-by-step solution
2. Visual explanation if applicable
3. Key concepts used
4. Common mistakes to avoid`
    
    const solution = await withRetry(() => callAI([{ role: 'user', content: prompt }]))
    
    res.json({ success: true, solution })
  } catch (error) {
    handleAIError(error, res, 'solve doubt')
  }
})

// ─── Exam Predictor ───
router.post('/exam-predictor', async (req, res) => {
  try {
    const { subject, topics, examType } = req.body
    
    const prompt = `Predict important questions for ${examType} exam in ${subject}:
Topics: ${topics.join(', ')}

Provide:
1. Top 10 predicted questions with importance rating
2. Reasoning for each prediction
3. Study priority order

Format as JSON:
{
  "predictions": [{"question": "...", "importance": "high", "reason": "..."}],
  "priorities": ["topic1", "topic2"]
}`
    
    const text = await withRetry(() => callAI([{ role: 'user', content: prompt }]))
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const predictions = jsonMatch ? JSON.parse(jsonMatch[0]) : { predictions: [], priorities: [] }
    
    res.json({ success: true, ...predictions })
  } catch (error) {
    handleAIError(error, res, 'predict questions')
  }
})

// ─── Assignment Helper ───
router.post('/assignment', async (req, res) => {
  try {
    const { topic, requirements, wordCount, stage } = req.body
    
    let prompt = ''
    if (stage === 'outline') {
      prompt = `Create a detailed outline for an assignment on: ${topic}
Requirements: ${requirements}
Word count: ${wordCount}

Include: Introduction, main sections, conclusion, key points for each section`
    } else if (stage === 'draft') {
      prompt = `Write a draft for: ${topic}
Requirements: ${requirements}
Target: ${wordCount} words

Provide well-structured content with proper citations format`
    } else {
      prompt = `Review and improve this assignment draft:
${requirements}

Suggest improvements for: clarity, structure, grammar, academic tone`
    }
    
    const content = await withRetry(() => callAI([{ role: 'user', content: prompt }]))
    
    res.json({ success: true, content })
  } catch (error) {
    handleAIError(error, res, 'help with assignment')
  }
})

// ─── Explain Like I'm 5 ───
router.post('/eli5', async (req, res) => {
  try {
    const { topic, complexity = 5 } = req.body
    
    const levels = {
      1: 'a 5-year-old child with simple words and analogies',
      3: 'a middle school student with basic examples',
      5: 'a high school student with moderate detail',
      7: 'a college student with technical terms',
      10: 'an expert with full complexity'
    }
    
    const prompt = `Explain "${topic}" as if explaining to ${levels[complexity] || levels[5]}.

Use:
- Simple analogies and examples
- Clear structure
- Relatable comparisons
- Visual descriptions`
    
    const explanation = await withRetry(() => callAI([{ role: 'user', content: prompt }]))
    
    res.json({ success: true, explanation })
  } catch (error) {
    handleAIError(error, res, 'explain topic')
  }
})

// ─── Formula Sheet Generator ───
router.post('/formula-sheet', async (req, res) => {
  try {
    const { subject, topics } = req.body
    
    const prompt = `Generate a comprehensive formula sheet for ${subject}:
Topics: ${topics.join(', ')}

Include:
- All important formulas
- Variable definitions
- When to use each formula
- Example values
- Units

Format in organized sections with clear headings`
    
    const formulaSheet = await withRetry(() => callAI([{ role: 'user', content: prompt }]))
    
    res.json({ success: true, formulaSheet })
  } catch (error) {
    handleAIError(error, res, 'generate formula sheet')
  }
})

// ─── Voice Notes to Text ───
router.post('/voice-to-text', async (req, res) => {
  try {
    const { transcript, subject } = req.body
    
    const prompt = `Convert this lecture transcript into organized notes for ${subject}:

${transcript}

Format as:
# Topic
## Subtopic
- Key point 1
- Key point 2

Include:
- Main concepts
- Important definitions
- Examples mentioned
- Action items or homework`
    
    const notes = await withRetry(() => callAI([{ role: 'user', content: prompt }]))
    
    res.json({ success: true, notes })
  } catch (error) {
    handleAIError(error, res, 'convert voice notes')
  }
})

// ─── Lab Report Writer ───
router.post('/lab-report', async (req, res) => {
  try {
    const { experimentType, observations, data } = req.body
    
    const prompt = `Generate a lab report for: ${experimentType}

Observations: ${observations}
Data: ${JSON.stringify(data)}

Include standard sections:
1. Title
2. Objective
3. Materials & Methods
4. Observations
5. Data Analysis
6. Results
7. Discussion
8. Conclusion

Use proper scientific format and terminology`
    
    const report = await withRetry(() => callAI([{ role: 'user', content: prompt }]))
    
    res.json({ success: true, report })
  } catch (error) {
    handleAIError(error, res, 'generate lab report')
  }
})

export default router
