import React, { useState } from 'react'
import { Icon } from './components/Icon'
import { supabase } from '../api/supabase'
import { useProjectStore } from '../store/projectStore'
import { useCanvasStore } from '../store/canvasStore'

interface AuthModalProps {
  onClose: () => void
  initialMode?: 'signin' | 'signup'
}

export function AuthModal({ onClose, initialMode = 'signin' }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const { setIsGuest, setProjectId, projectName } = useProjectStore()
  const { features } = useCanvasStore()

  async function ensureProject(userId: string) {
    // Check if user already has a project
    const { data } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (data?.id) {
      setProjectId(data.id)
      return
    }

    // Create a new project, migrating any guest features
    const { data: newProject } = await supabase
      .from('projects')
      .insert({ user_id: userId, name: projectName, geojson: features })
      .select('id')
      .single()

    if (newProject?.id) setProjectId(newProject.id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        })
        if (error) throw error
        setSuccess(true)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setIsGuest(false)
        if (data.user) await ensureProject(data.user.id)
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  function continueAsGuest() {
    setIsGuest(true)
    onClose()
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 38, padding: '0 10px', fontSize: 13, borderRadius: 6,
    border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)',
    color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)' }} />

      <div style={{ position: 'relative', width: 380, background: 'var(--color-bg-panel)', borderRadius: 14, border: '1px solid var(--color-border)', boxShadow: '0 24px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
        {/* Logo header */}
        <div style={{ padding: '24px 24px 16px', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, background: '#A3B57A', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18, fontFamily: "'Inter Tight', sans-serif", margin: '0 auto 12px' }}>
            UD
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', margin: '0 0 4px' }}>
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
            {mode === 'signin' ? 'Sign in to your Urban Designer account' : 'Start designing for free'}
          </p>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📧</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>Check your email</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>We sent a confirmation link to <strong>{email}</strong></div>
              <button onClick={onClose} style={{ marginTop: 16, height: 36, padding: '0 20px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer' }}>
                Got it
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mode === 'signup' && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Full Name</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" required style={inputStyle} />
                </div>
              )}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={8} style={inputStyle} />
              </div>

              {error && (
                <div style={{ padding: '8px 10px', borderRadius: 6, background: '#FEE2E2', color: '#DC2626', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Icon name="info" size={13} color="#DC2626" /> {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{ height: 40, borderRadius: 7, border: 'none', background: loading ? 'var(--color-border)' : 'var(--color-accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', marginTop: 4 }}>
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
                {mode === 'signin' ? (
                  <>Don't have an account? <button type="button" onClick={() => { setMode('signup'); setError(null) }} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 12 }}>Sign up free</button></>
                ) : (
                  <>Already have an account? <button type="button" onClick={() => { setMode('signin'); setError(null) }} style={{ background: 'none', border: 'none', color: 'var(--color-accent)', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 12 }}>Sign in</button></>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              </div>

              <button type="button" onClick={continueAsGuest} style={{ height: 36, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-sec)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Continue as guest
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
