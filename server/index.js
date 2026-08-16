const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(bodyParser.json())

const GROQ_KEY = process.env.GROQ_API_KEY
let groqClient = null
if (GROQ_KEY) {
  try {
    const Groq = require('groq-sdk')
    groqClient = new Groq({ apiKey: GROQ_KEY })
  } catch (e) {
    console.warn('groq-sdk not available; fallback active')
  }
}

function stripMarkdown(text) {
  if (!text) return text
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[*+]\s+/gm, '- ')
    .replace(/^\t+\+\s+/gm, '  - ')
    .trim()
}

// The model doesn't always honor response_format json_object — this pulls
// { optimized, suggestions } out of a normal prose/markdown reply as a fallback.
function extractOptimizeResult(raw) {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      if (parsed.optimized) {
        return {
          optimized: stripMarkdown(parsed.optimized),
          suggestions: (Array.isArray(parsed.suggestions) ? parsed.suggestions : []).map(stripMarkdown)
        }
      }
    } catch (e) {}
  }

  const splitRegex = /\n+(?:\*\*)?(?:concise |additional |here are (?:some )?)?suggestions?(?:\*\*)?:?\s*\n/i
  const parts = raw.split(splitRegex)
  let resumePart = parts[0] || raw
  const suggestionsPart = parts.length > 1 ? parts.slice(1).join('\n') : ''

  resumePart = resumePart.replace(/^.*here'?s (an|the) optimized.*\n+/i, '')

  const suggestions = suggestionsPart
    .split(/\n(?=\d+\.\s)/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => stripMarkdown(s.replace(/^\d+\.\s*/, '')))

  return { optimized: stripMarkdown(resumePart.trim()), suggestions }
}

async function callModel(prompt, systemMsg) {
  async function attempt(model) {
    return groqClient.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 900
    })
  }
  try {
    return await attempt('llama-3.3-70b-versatile')
  } catch (err) {
    console.warn('primary model failed, falling back to llama-3.1-8b-instant:', err.message)
    return await attempt('llama-3.1-8b-instant')
  }
}

// Step 1: optimize resume, return structured JSON (fixes the "everything dumped into one string" bug)
app.post('/api/optimize', async (req, res) => {
  const { resume = '', job = '' } = req.body || {}
  if (!resume) return res.status(400).json({ error: 'missing resume text' })

  if (groqClient) {
    try {
      const prompt = `Improve the resume below to better match this job description.\n\nJob description:\n${job}\n\nResume:\n${resume}`
      const systemMsg = 'You are an expert resume editor. Respond with ONLY a single valid JSON object — no preamble, no explanation, no markdown, nothing before or after it. The object must have exactly these two keys: "optimized" (the improved resume as plain text, no markdown formatting, no asterisks) and "suggestions" (an array of short plain-text suggestion strings, no markdown formatting, no asterisks). Example shape: {"optimized": "...", "suggestions": ["...", "..."]}'
      const resp = await callModel(prompt, systemMsg)
      const raw = resp.choices?.[0]?.message?.content || '{}'
      const { optimized, suggestions } = extractOptimizeResult(raw)
      return res.json({ optimized, suggestions })
    } catch (e) {
      console.error('groq error', e)
      return res.status(500).json({ error: 'LLM error' })
    }
  }

  const suggestions = []
  if (resume.length < 200) suggestions.push('Expand on achievements with metrics')
  if (job && !resume.toLowerCase().includes(job.split(/[ ,.]/)[0].toLowerCase())) suggestions.push('Include keywords from the job description')
  const optimized = resume + '\n\nSuggested improvements:\n- Use metrics (e.g., increased sales by 20%)\n- Start bullets with action verbs.'
  res.json({ optimized, suggestions })
})

// Step 2: turn suggestions into specific fill-in-the-blank questions
app.post('/api/restructure-questions', async (req, res) => {
  const { resume = '', suggestions = [] } = req.body || {}
  if (!resume || !suggestions.length) return res.status(400).json({ error: 'missing resume or suggestions' })
  if (!groqClient) return res.status(503).json({ error: 'This step requires a configured Groq API key.' })

  try {
    const prompt = `Resume:\n${resume}\n\nSuggestions for improvement:\n${suggestions.join('\n')}`
    const systemMsg = 'Based on the resume and suggestions, write 3-6 short, specific questions to ask the candidate to gather the missing details needed to apply each suggestion (e.g. ask for a specific metric, a specific technology used, a specific measurable outcome). Return ONLY a JSON object: { "questions": [{ "id": "q1", "title": "2-4 word category label, e.g. \'API Performance\'", "question": "the actual question, one sentence" }] }.'
    const resp = await callModel(prompt, systemMsg)
    const raw = resp.choices?.[0]?.message?.content || '{}'
    let parsed
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
    } catch { parsed = { questions: [] } }
    const questions = (Array.isArray(parsed.questions) ? parsed.questions : []).map((q, i) => ({
      id: q.id || `q${i + 1}`,
      title: stripMarkdown(q.title || `Question ${i + 1}`),
      question: stripMarkdown(q.question || '')
    }))
    res.json({ questions })
  } catch (e) {
    console.error('groq error', e)
    res.status(500).json({ error: 'LLM error' })
  }
})

// Step 3: regenerate the resume using the candidate's answers
app.post('/api/restructure', async (req, res) => {
  const { resume = '', suggestions = [], answers = {} } = req.body || {}
  if (!resume) return res.status(400).json({ error: 'missing resume text' })
  if (!groqClient) return res.status(503).json({ error: 'This step requires a configured Groq API key.' })

  try {
    const answerText = Object.entries(answers).map(([q, a]) => `Q: ${q}\nA: ${a}`).join('\n\n')
    const prompt = `Original resume:\n${resume}\n\nSuggestions previously given:\n${suggestions.join('\n')}\n\nCandidate's answers filling in the missing details:\n${answerText}\n\nRewrite the resume incorporating these answers naturally.`
    const systemMsg = 'You are an expert resume editor. Return ONLY a JSON object with exactly one key: "optimized" (the fully rewritten resume as plain text, no markdown formatting).'
    const resp = await callModel(prompt, systemMsg)
    const raw = resp.choices?.[0]?.message?.content || '{}'
    let parsed
    try { parsed = JSON.parse(raw) } catch { parsed = { optimized: raw } }
    res.json({ optimized: stripMarkdown(parsed.optimized || '') })
  } catch (e) {
    console.error('groq error', e)
    res.status(500).json({ error: 'LLM error' })
  }
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => console.log('Cavaner server listening on', PORT, '— auto-deploy test v1'))