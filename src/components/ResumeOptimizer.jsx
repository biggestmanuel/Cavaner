import React, { useState } from 'react'

export default function ResumeOptimizer() {
  const [resume, setResume] = useState('')
  const [job, setJob] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  async function submit() {
    if (!resume.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume, job })
      })
      if (!res.ok) {
        let message = `Server error (${res.status})`
        try {
          const errBody = await res.json()
          if (errBody?.error) message = errBody.error
        } catch (parseErr) {
          // response wasn't JSON — keep the status-based message
        }
        throw new Error(message)
      }
      const j = await res.json()
      setResult(j)
    } catch (e) {
      setResult({ error: e.message })
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setResume('')
    setJob('')
    setResult(null)
  }

  return (
    <div className="optimizer">
      <div className="panel">
        <label className="field-label">Resume</label>
        <textarea
          value={resume}
          onChange={e => setResume(e.target.value)}
          placeholder="Paste your resume text here…"
          rows={10}
        />
        <label className="field-label">Job Description (optional)</label>
        <textarea
          value={job}
          onChange={e => setJob(e.target.value)}
          placeholder="Paste the job description to tailor your resume against it…"
          rows={6}
        />
        <div className="controls">
          <span className="char-count">{resume.length.toLocaleString()} characters</span>
          <div className="control-buttons">
            <button className="btn-secondary" onClick={clear} disabled={loading && !resume}>
              Clear
            </button>
            <button className="btn-primary" onClick={submit} disabled={loading || !resume.trim()}>
              {loading ? 'Optimizing…' : 'Optimize Resume'}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="result">
          {result.error && <div className="error">{result.error}</div>}
          {result.optimized && (
            <section>
              <h3>Optimized Resume</h3>
              <pre>{result.optimized}</pre>
            </section>
          )}
          {result.suggestions && result.suggestions.length > 0 && (
            <section>
              <h3 className="suggestions-heading">Suggestions</h3>
              <ul>{result.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
