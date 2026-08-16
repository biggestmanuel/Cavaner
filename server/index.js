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
      const systemMsg = 'You are an expert resume editor. Return ONLY a JSON object with exactly these keys: "optimized" (the improved resume as plain text, no markdown formatting), "suggestions" (an array of short plain-text suggestion strings, no markdown formatting, no asterisks).'
      const resp = await callModel(prompt, systemMsg)
      const raw = resp.choices?.[0]?.message?.content || '{}'
      let parsed
      try { parsed = JSON.parse(raw) } catch { parsed = { optimized: raw, suggestions: [] } }
      return res.json({
        optimized: parsed.optimized || '',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : []
      })
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
    const systemMsg = 'Based on the resume and suggestions, write 3-6 short, specific questions to ask the candidate to gather the missing details needed to apply each suggestion (e.g. ask for a specific metric, a specific technology used, a specific measurable outcome). Return ONLY a JSON object: { "questions": [{ "id": "q1", "question": "..." }] }.'
    const resp = await callModel(prompt, systemMsg)
    const raw = resp.choices?.[0]?.message?.content || '{}'
    let parsed
    try { parsed = JSON.parse(raw) } catch { parsed = { questions: [] } }
    res.json({ questions: Array.isArray(parsed.questions) ? parsed.questions : [] })
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
    res.json({ optimized: parsed.optimized || '' })
  } catch (e) {
    console.error('groq error', e)
    res.status(500).json({ error: 'LLM error' })
  }
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => console.log('Cavaner server listening on', PORT))
