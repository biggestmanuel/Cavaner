import React, { useState } from 'react'
import html2pdf from 'html2pdf.js'
import { Document, Packer, Paragraph } from 'docx'
import { saveAs } from 'file-saver'

const API = import.meta.env.VITE_API_URL || ''

// Turns "text with **bold** words" into safe HTML with real <strong> tags.
function renderBold(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  return { __html: withBold }
}

export default function ResumeOptimizer() {
  const [resume, setResume] = useState('')
  const [job, setJob] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null) // { optimized, suggestions }
  const [view, setView] = useState('form') // form | resume | suggestions | qa
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [restructuring, setRestructuring] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  async function postJSON(path, body) {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      let message = `Server error (${res.status})`
      try {
        const errBody = await res.json()
        if (errBody?.error) message = errBody.error
      } catch (e) {}
      throw new Error(message)
    }
    return res.json()
  }

  async function submit() {
    if (!resume.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const j = await postJSON('/api/optimize', { resume, job })
      setResult(j)
      setView('resume')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function clear() {
    setResume('')
    setJob('')
    setResult(null)
    setError(null)
    setView('form')
    setQuestions([])
    setAnswers({})
  }

  async function startRestructure() {
    setRestructuring(true)
    setError(null)
    try {
      const j = await postJSON('/api/restructure-questions', {
        resume: result.optimized,
        suggestions: result.suggestions || []
      })
      setQuestions(j.questions || [])
      setAnswers({})
      setView('qa')
    } catch (e) {
      setError(e.message)
    } finally {
      setRestructuring(false)
    }
  }

  async function submitAnswers() {
    setRestructuring(true)
    setError(null)
    try {
      const j = await postJSON('/api/restructure', {
        resume: result.optimized,
        suggestions: result.suggestions || [],
        answers
      })
      // No suggestions this time around — that's intentional, one restructure pass only.
      setResult({ optimized: j.optimized, suggestions: [] })
      setView('resume')
    } catch (e) {
      setError(e.message)
    } finally {
      setRestructuring(false)
    }
  }

  function exportHtml() {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Resume</title>
      <style>body{font-family:Arial,sans-serif;white-space:pre-wrap;max-width:700px;margin:40px auto;line-height:1.6;color:#1a1a1a}</style>
      </head><body>${result.optimized.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br/>')}</body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'resume.html'
    a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
  }

  function exportPdf() {
    const el = document.createElement('div')
    el.style.whiteSpace = 'pre-wrap'
    el.style.fontFamily = 'Arial, sans-serif'
    el.style.padding = '24px'
    el.style.color = '#1a1a1a'
    el.style.lineHeight = '1.6'
    el.innerText = result.optimized
    html2pdf().from(el).set({ filename: 'resume.pdf', margin: 10 }).save()
    setExportOpen(false)
  }

  async function exportDocx() {
    const doc = new Document({
      sections: [{
        children: result.optimized.split('\n').map(line => new Paragraph(line))
      }]
    })
    const blob = await Packer.toBlob(doc)
    saveAs(blob, 'resume.docx')
    setExportOpen(false)
  }

  return (
    <div className="optimizer">
      {view === 'form' && (
        <div className="panel">
          <label className="field-label">Resume</label>
          <textarea value={resume} onChange={e => setResume(e.target.value)} placeholder="Paste your resume text here…" rows={10} />
          <label className="field-label">Job Description (optional)</label>
          <textarea value={job} onChange={e => setJob(e.target.value)} placeholder="Paste the job description to tailor your resume against it…" rows={6} />
          <div className="controls">
            <span className="char-count">{resume.length.toLocaleString()} characters</span>
            <div className="control-buttons">
              <button className="btn-secondary" onClick={clear} disabled={loading}>Clear</button>
              <button className="btn-primary" onClick={submit} disabled={loading || !resume.trim()}>
                {loading ? 'Optimizing…' : 'Optimize Resume'}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="result"><div className="error">{error}</div></div>}

      {result && view === 'resume' && (
        <div className="result">
          <section>
            <h3>Optimized Resume</h3>
            <pre>{result.optimized}</pre>
          </section>
          <div className="stage-actions">
            {result.suggestions && result.suggestions.length > 0 && (
              <button className="btn-secondary" onClick={() => setView('suggestions')}>Suggestions</button>
            )}
            <button className="btn-primary" onClick={() => setExportOpen(true)}>Export</button>
            <button className="btn-secondary" onClick={clear}>Start Over</button>
          </div>
        </div>
      )}

      {result && view === 'suggestions' && (
        <div className="result">
          <section>
            <h3 className="suggestions-heading">Suggestions</h3>
            <ul>
              {result.suggestions.map((s, i) => (
                <li key={i} dangerouslySetInnerHTML={renderBold(s)} />
              ))}
            </ul>
          </section>
          <div className="stage-actions">
            <button className="btn-secondary" onClick={() => setView('resume')}>Back to Resume</button>
            <button className="btn-primary" onClick={startRestructure} disabled={restructuring}>
              {restructuring ? 'Preparing questions…' : 'Restructure Resume'}
            </button>
          </div>
        </div>
      )}

      {view === 'qa' && (
        <div className="result">
          <section>
            <h3 className="suggestions-heading">A Few Details</h3>
            <p className="qa-intro">Answer what you can — these fill in the gaps the suggestions pointed out.</p>
            {questions.map(q => (
              <div key={q.id} className="qa-field">
                <label className="field-label">{q.question}</label>
                <textarea
                  rows={2}
                  value={answers[q.question] || ''}
                  onChange={e => setAnswers(a => ({ ...a, [q.question]: e.target.value }))}
                />
              </div>
            ))}
          </section>
          <div className="stage-actions">
            <button className="btn-secondary" onClick={() => setView('suggestions')} disabled={restructuring}>Back</button>
            <button className="btn-primary" onClick={submitAnswers} disabled={restructuring}>
              {restructuring ? 'Rewriting…' : 'Done'}
            </button>
          </div>
        </div>
      )}

      {exportOpen && (
        <div className="modal-overlay" onClick={() => setExportOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Export Resume</h3>
            <p className="qa-intro">Choose a format to download.</p>
            <div className="modal-format-grid">
              <button className="modal-format-btn" onClick={exportHtml}>.html</button>
              <button className="modal-format-btn" onClick={exportPdf}>.pdf</button>
              <button className="modal-format-btn" onClick={exportDocx}>.docx</button>
            </div>
            <button className="btn-secondary modal-close" onClick={() => setExportOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
