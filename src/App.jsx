import React from 'react'
import ResumeOptimizer from './components/ResumeOptimizer'

export default function App(){
  return (
    <div className="app">
      <header>
        <h1>Cavaner — Resume Optimizer</h1>
        <p>Paste your resume and a job description; get tailored resume text and suggested CV.</p>
      </header>
      <main>
        <ResumeOptimizer />
      </main>
    </div>
  )
}
