import express from 'express'
import { GoogleGenerativeAI } from '@google/generative-ai'
import multer from 'multer'
import pdfParse from 'pdf-parse'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// ─── Study Assistant ───
router.post('/assistant', authMiddleware, async (req, res) => {
  try {
    const { message, history = [] } = req.body
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' })
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    // Filter and format history - must start with 'user' role
    const formattedHistory = history
      .filter(h => h.content && h.content.trim() && h.role !== 'ai') // Remove empty and initial AI messages
      .map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      }))
    
    // If no history or history is empty, use simple generation
    if (formattedHistory.length === 0) {
      const result = await model.generateContent(message)
      const response = result.response.text()
      return res.json({ success: true, response })
    }
    
    // Ensure first message is from user
    if (formattedHistory[0].role === 'model') {
      formattedHistory.shift()
    }
    
    // Use chat with history
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: { maxOutputTokens: 1000 }
    })
    
    const result = await chat.sendMessage(message)
    const response = result.response.text()
    
    res.json({ success: true, response })
  } catch (error) {
    console.error('Assistant error:', error)
    res.status(500).json({ 
      error: 'Failed to get AI response',
      details: error.message 
    })
  }
})

// ─── Quiz Generator ───
router.post('/quiz', authMiddleware, upload.single('pdf'), async (req, res) => {
  try {
    const { topic, numQuestions = 10, difficulty = 'medium' } = req.body
    let content = topic
    
    if (req.file) {
      const pdfData = await pdfParse(req.file.buffer)
      content = pdfData.text.substring(0, 5000)
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const prompt = `Generate ${numQuestions} ${difficulty} difficulty multiple-choice questions about: ${content}

Format as JSON array:
[{
  "question": "Question text",
  "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
  "correct": 0,
  "explanation": "Why this is correct"
}]`
    
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const questions = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    
    res.json({ success: true, questions })
  } catch (error) {
    console.error('Quiz generation error:', error)
    res.status(500).json({ error: 'Failed to generate quiz' })
  }
})

// ─── Study Plan Creator ───
router.post('/study-plan', authMiddleware, async (req, res) => {
  try {
    const { exams, hoursPerDay, subjects } = req.body
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
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
    
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const plan = jsonMatch ? JSON.parse(jsonMatch[0]) : { plan: [], tips: [] }
    
    res.json({ success: true, ...plan })
  } catch (error) {
    console.error('Study plan error:', error)
    res.status(500).json({ error: 'Failed to create study plan' })
  }
})

// ─── Notes Summarizer ───
router.post('/summarize', authMiddleware, upload.single('pdf'), async (req, res) => {
  try {
    const { notes } = req.body
    let content = notes
    
    if (req.file) {
      const pdfData = await pdfParse(req.file.buffer)
      content = pdfData.text
    }
    
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
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
    
    const result = await model.generateContent(prompt)
    const summary = result.response.text()
    
    res.json({ success: true, summary })
  } catch (error) {
    console.error('Summarize error:', error)
    res.status(500).json({ error: 'Failed to summarize notes' })
  }
})

// ─── Flashcard Generator ───
router.post('/flashcards', authMiddleware, async (req, res) => {
  try {
    const { topic, content, count = 10 } = req.body
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    const prompt = `Generate ${count} flashcards for: ${topic}
${content ? `Content: ${content.substring(0, 3000)}` : ''}

Format as JSON array:
[{
  "front": "Question or term",
  "back": "Answer or definition",
  "category": "subtopic"
}]`
    
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const flashcards = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    
    res.json({ success: true, flashcards })
  } catch (error) {
    console.error('Flashcards error:', error)
    res.status(500).json({ error: 'Failed to generate flashcards' })
  }
})

// ─── Doubt Solver ───
router.post('/doubt-solver', authMiddleware, async (req, res) => {
  try {
    const { question, subject } = req.body
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    const prompt = `Solve this ${subject} question with step-by-step explanation:

${question}

Provide:
1. Clear step-by-step solution
2. Visual explanation if applicable
3. Key concepts used
4. Common mistakes to avoid`
    
    const result = await model.generateContent(prompt)
    const solution = result.response.text()
    
    res.json({ success: true, solution })
  } catch (error) {
    console.error('Doubt solver error:', error)
    res.status(500).json({ error: 'Failed to solve doubt' })
  }
})

// ─── Exam Predictor ───
router.post('/exam-predictor', authMiddleware, async (req, res) => {
  try {
    const { subject, topics, examType } = req.body
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
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
    
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const predictions = jsonMatch ? JSON.parse(jsonMatch[0]) : { predictions: [], priorities: [] }
    
    res.json({ success: true, ...predictions })
  } catch (error) {
    console.error('Exam predictor error:', error)
    res.status(500).json({ error: 'Failed to predict questions' })
  }
})

// ─── Assignment Helper ───
router.post('/assignment', authMiddleware, async (req, res) => {
  try {
    const { topic, requirements, wordCount, stage } = req.body
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
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
    
    const result = await model.generateContent(prompt)
    const content = result.response.text()
    
    res.json({ success: true, content })
  } catch (error) {
    console.error('Assignment helper error:', error)
    res.status(500).json({ error: 'Failed to help with assignment' })
  }
})

// ─── Explain Like I'm 5 ───
router.post('/eli5', authMiddleware, async (req, res) => {
  try {
    const { topic, complexity = 5 } = req.body
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
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
    
    const result = await model.generateContent(prompt)
    const explanation = result.response.text()
    
    res.json({ success: true, explanation })
  } catch (error) {
    console.error('ELI5 error:', error)
    res.status(500).json({ error: 'Failed to explain topic' })
  }
})

// ─── Formula Sheet Generator ───
router.post('/formula-sheet', authMiddleware, async (req, res) => {
  try {
    const { subject, topics } = req.body
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    const prompt = `Generate a comprehensive formula sheet for ${subject}:
Topics: ${topics.join(', ')}

Include:
- All important formulas
- Variable definitions
- When to use each formula
- Example values
- Units

Format in organized sections with clear headings`
    
    const result = await model.generateContent(prompt)
    const formulaSheet = result.response.text()
    
    res.json({ success: true, formulaSheet })
  } catch (error) {
    console.error('Formula sheet error:', error)
    res.status(500).json({ error: 'Failed to generate formula sheet' })
  }
})

// ─── Voice Notes to Text ───
router.post('/voice-to-text', authMiddleware, async (req, res) => {
  try {
    const { transcript, subject } = req.body
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
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
    
    const result = await model.generateContent(prompt)
    const notes = result.response.text()
    
    res.json({ success: true, notes })
  } catch (error) {
    console.error('Voice to text error:', error)
    res.status(500).json({ error: 'Failed to convert voice notes' })
  }
})

// ─── Lab Report Writer ───
router.post('/lab-report', authMiddleware, async (req, res) => {
  try {
    const { experimentType, observations, data } = req.body
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
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
    
    const result = await model.generateContent(prompt)
    const report = result.response.text()
    
    res.json({ success: true, report })
  } catch (error) {
    console.error('Lab report error:', error)
    res.status(500).json({ error: 'Failed to generate lab report' })
  }
})

export default router
