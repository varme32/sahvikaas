const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions'
const OPENROUTER_MODEL = 'google/gemini-2.0-flash-001'

/**
 * Produce 3–5 short bullet insights from structured user stats (JSON).
 */
export async function generateStudyInsights(statsPayload) {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) {
    return [
      'Connect OPENROUTER_API_KEY for AI-generated insights.',
      `You logged ${statsPayload.studyHoursLast30d ?? 0} hours in the last 30 days.`,
    ]
  }
  const body = JSON.stringify(statsPayload).slice(0, 6000)
  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 500,
        temperature: 0.5,
        messages: [
          {
            role: 'user',
            content: `You are an academic coach. Given this JSON user study stats, output EXACTLY 4 short insights (one per line), plain text, no numbering or markdown. Be specific and encouraging. Stats:\n${body}`,
          },
        ],
      }),
    })
    if (!response.ok) throw new Error(`OpenRouter ${response.status}`)
    const data = await response.json()
    const text = data.choices?.[0]?.message?.content || ''
    return text
      .split('\n')
      .map(s => s.replace(/^[-•*\d.)]+\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 6)
  } catch (err) {
    console.error('AI insights error:', err.message)
    return ['AI insights temporarily unavailable.', 'Keep a consistent daily study rhythm for best results.']
  }
}
