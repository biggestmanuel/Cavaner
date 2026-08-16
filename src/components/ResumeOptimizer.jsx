import React, { useState, useRef } from 'react'
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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [restructuring, setRestructuring] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const requestIdRef = useRef(0)

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
    const myRequestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const j = await postJSON('/api/optimize', { resume, job })
      if (myRequestId !== requestIdRef.current) return // a newer request superseded this one
      setResult(j)
      setView('resume')
    } catch (e) {
      if (myRequestId !== requestIdRef.current) return
      setError(e.message)
    } finally {
      if (myRequestId === requestIdRef.current) setLoading(false)
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
    const myRequestId = ++requestIdRef.current
    setRestructuring(true)
    setError(null)
    try {
      const j = await postJSON('/api/restructure-questions', {
        resume: result.optimized,
        suggestions: result.suggestions || []
      })
      if (myRequestId !== requestIdRef.current) return
      setQuestions(j.questions || [])
      setAnswers({})
      setCurrentQuestionIndex(0)
      setView('qa')
    } catch (e) {
      if (myRequestId !== requestIdRef.current) return
      setError(e.message)
    } finally {
      if (myRequestId === requestIdRef.current) setRestructuring(false)
    }
  }

  async function submitAnswers() {
    const myRequestId = ++requestIdRef.current
    setRestructuring(true)
    setError(null)
    try {
      const j = await postJSON('/api/restructure', {
        resume: result.optimized,
        suggestions: result.suggestions || [],
        answers
      })
      if (myRequestId !== requestIdRef.current) return
      // No suggestions this time around — that's intentional, one restructure pass only.
      setResult({ optimized: j.optimized, suggestions: [] })
      setView('resume')
    } catch (e) {
      if (myRequestId !== requestIdRef.current) return
      setError(e.message)
    } finally {
      if (myRequestId === requestIdRef.current) setRestructuring(false)
    }
  }

  function exportHtml() {
    if (!result?.optimized?.trim()) return
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
    if (!result?.optimized?.trim()) return
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
    if (!result?.optimized?.trim()) return
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

      {result && view === 'resume' && result.optimized && result.optimized.trim() && (
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

      {view === 'qa' && questions.length > 0 && (
        <div className="result">
          <div className="qa-header">
            <button className="qa-exit" onClick={() => setView('suggestions')} disabled={restructuring}>‹ Suggestions</button>
            <span className="qa-progress">
              {Object.values(answers).filter(a => a && a.trim()).length} of {questions.length} answered
            </span>
          </div>
          <p className="qa-intro">Answer what you can — you don't need to answer everything.</p>

          {(() => {
            const q = questions[currentQuestionIndex]
            const isLast = currentQuestionIndex === questions.length - 1
            return (
              <div className="qa-card">
                <div className="qa-card-title">{currentQuestionIndex + 1} — {q.title}</div>
                <p className="qa-card-question">{q.question}</p>
                <textarea
                  rows={3}
                  placeholder="Your answer…"
                  value={answers[q.question] || ''}
                  onChange={e => setAnswers(a => ({ ...a, [q.question]: e.target.value }))}
                  autoFocus
                />
                <div className="qa-nav-row">
                  <button
                    className="btn-secondary"
                    onClick={() => setCurrentQuestionIndex(i => Math.max(0, i - 1))}
                    disabled={currentQuestionIndex === 0 || restructuring}
                  >
                    Back
                  </button>
                  <div className="qa-nav-right">
                    <button
                      className="btn-secondary"
                      onClick={() => (isLast ? submitAnswers() : setCurrentQuestionIndex(i => i + 1))}
                      disabled={restructuring}
                    >
                      Skip
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => (isLast ? submitAnswers() : setCurrentQuestionIndex(i => i + 1))}
                      disabled={restructuring}
                    >
                      {restructuring ? 'Rewriting…' : isLast ? 'Finish' : 'Continue →'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })()}
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