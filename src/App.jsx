import React, { useEffect, useState } from 'react'
import ResumeOptimizer from './components/ResumeOptimizer'

function getInitialTheme() {
  const saved = localStorage.getItem('cavaner-theme')
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('cavaner-theme', theme)
  }, [theme])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="logo-mark" src="/logo.png" alt="Cavaner" width="44" height="44" />
          <div className="brand-text">
            <h1>Cavaner</h1>
            <p className="tagline">
              <span className="tag-build">Build.</span>{' '}
              <span className="tag-solve">Solve.</span>{' '}
              <span className="tag-elevate">Elevate.</span>
            </p>
          </div>
        </div>
        <button
          className="theme-toggle"
          onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
          aria-label="Toggle color theme"
        >
          {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
        </button>
      </header>
      <main>
        <ResumeOptimizer />
      </main>
    </div>
  )
}
