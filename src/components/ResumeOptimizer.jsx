import React, {useState} from 'react'

export default function ResumeOptimizer(){
  const [resume, setResume] = useState('')
  const [job, setJob] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  async function submit(){
    if(!resume.trim()) return
    setLoading(true); setResult(null)
    try{
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/optimize`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({resume, job})})
      if(!res.ok) throw new Error('Server error')
      const j = await res.json()
      setResult(j)
    }catch(e){
      setResult({error:e.message})
    }finally{setLoading(false)}
  }

  return (
    <div className="optimizer">
      <textarea value={resume} onChange={e=>setResume(e.target.value)} placeholder="Paste your resume text here" rows={10} />
      <textarea value={job} onChange={e=>setJob(e.target.value)} placeholder="Paste the job description (optional)" rows={6} />
      <div className="controls"><button onClick={submit} disabled={loading}>Optimize Resume</button></div>
      {loading && <p>Optimizing...</p>}
      {result && (
        <div className="result">
          {result.error && <div className="error">{result.error}</div>}
          {result.optimized && (
            <section>
              <h3>Optimized Resume</h3>
              <pre>{result.optimized}</pre>
            </section>
          )}
          {result.suggestions && (
            <section>
              <h3>Suggestions</h3>
              <ul>{result.suggestions.map((s,i)=><li key={i}>{s}</li>)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
