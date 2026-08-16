import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Auth() {
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        if (data?.user && !data.session) {
          setMessage('Check your email to confirm your account, then log in.')
          setMode('login')
        }
        // If email confirmation is disabled in Supabase, data.session exists
        // and App.jsx's onAuthStateChange listener picks it up automatically.
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        // Successful login is picked up by the onAuthStateChange listener in App.jsx.
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="optimizer">
      <div className="panel auth-panel">
        <h2 className="auth-title">{mode === 'login' ? 'Log In' : 'Create Account'}</h2>
        <form onSubmit={handleSubmit}>
          <label className="field-label">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
          <label className="field-label">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
            minLength={6}
            required
          />
          {error && <div className="error auth-error">{error}</div>}
          {message && <div className="auth-message">{message}</div>}
          <button className="btn-primary auth-submit" type="submit" disabled={loading}>
            {loading ? (mode === 'login' ? 'Logging in…' : 'Creating account…') : (mode === 'login' ? 'Log In' : 'Sign Up')}
          </button>
        </form>
        <button
          className="auth-switch"
          onClick={() => { setMode(m => (m === 'login' ? 'signup' : 'login')); setError(null); setMessage(null) }}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
        </button>
      </div>
    </div>
  )
}
