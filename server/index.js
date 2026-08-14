const express = require('express')
const bodyParser = require('body-parser')

const app = express()
app.use(bodyParser.json())

const GROQ_KEY = process.env.GROQ_API_KEY
let groqClient = null
if(GROQ_KEY){
  try{
    const Groq = require('groq')
    groqClient = new Groq({ apiKey: GROQ_KEY })
  }catch(e){
    console.warn('Groq client not available; fallback active')
  }
}

app.post('/api/optimize', async (req, res) => {
  const { resume='', job='' } = req.body || {}
  if(!resume) return res.status(400).json({ error: 'missing resume text' })

  if(groqClient){
    try{
      const prompt = `Improve the resume below to better match this job description. Provide an optimized resume and a short list of suggestions.\n\nJob description:\n${job}\n\nResume:\n${resume}`
      const resp = await groqClient.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {role:'system', content: 'You are an expert resume editor. Produce an optimized resume and concise suggestions.'},
          {role:'user', content: prompt}
        ],
        temperature:0.2,
        max_tokens:800
      })
      const answer = resp.choices?.[0]?.message?.content || ''
      return res.json({ optimized: answer, suggestions: [] })
    }catch(e){
      console.error('groq error', e)
      return res.status(500).json({ error: 'LLM error' })
    }
  }

  // Fallback: simple suggestions based on length and keywords
  const suggestions = []
  if(resume.length < 200) suggestions.push('Expand on achievements with metrics')
  if(job && !resume.toLowerCase().includes(job.split(/[ ,\.]/)[0].toLowerCase())) suggestions.push('Include keywords from the job description')

  const optimized = resume + '\n\n# Suggested improvements:\n- Use metrics (e.g., increased sales by 20%)\n- Start bullets with action verbs.'
  res.json({ optimized, suggestions })
})

const PORT = process.env.PORT || 3002
app.listen(PORT, ()=> console.log('Cavaner server listening on', PORT))
