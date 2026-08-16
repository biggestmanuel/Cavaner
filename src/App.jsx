import React, { useEffect, useState } from 'react'
import ResumeOptimizer from './components/ResumeOptimizer'
import Auth from './components/Auth'
import { supabase } from './lib/supabaseClient'

function getInitialTheme() {
  const saved = localStorage.getItem('cavaner-theme')
  if (saved) return saved
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme)
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('cavaner-theme', theme)
  }, [theme])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

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
        <div className="topbar-actions">
          {session && (
            <button className="theme-toggle" onClick={handleLogout}>Log Out</button>
          )}
          <button
            className="theme-toggle"
            onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>
      <main>
        {sessionLoading ? (
          <p className="session-loading">Loading…</p>
        ) : session ? (
          <ResumeOptimizer />
        ) : (
          <Auth />
        )}
      </main>
    </div>
  )
}
