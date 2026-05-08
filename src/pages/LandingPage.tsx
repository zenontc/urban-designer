import React, { useState } from 'react'
import { supabase } from '../api/supabase'
import { useProjectStore } from '../store/projectStore'

interface LandingPageProps {
  onNavigate: (page: string) => void
}

type AuthTab = 'signin' | 'signup'

const FEATURES = [
  { icon: '🗺', title: 'Real Maps', desc: 'Design directly on satellite and street maps' },
  { icon: '✏️', title: 'Precision Tools', desc: 'Draw streets, buildings, parks, and more' },
  { icon: '📐', title: 'Measurements', desc: 'Real-world distances, areas, and cross-sections' },
  { icon: '☁️', title: 'Cloud Sync', desc: 'Projects saved automatically to the cloud' },
]

export function LandingPage({ onNavigate }: LandingPageProps) {
  const [tab, setTab] = useState<AuthTab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { setIsGuest } = useProjectStore()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)
    try {
      if (tab === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
        setIsGuest(false)
        onNavigate('dashboard')
      } else {
        const { error: err } = await supabase.auth.signUp({ email, password, options: { data: { name } } })
        if (err) throw err
        setSuccess('Account created! Check your email to verify, then sign in.')
        setTab('signin')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleGuest() {
    setIsGuest(true)
    onNavigate('workspace')
  }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'grid', gridTemplateColumns: '1fr 420px',
      background: '#0A0F1E', overflow: 'hidden',
    }}>
      {/* Left: branding */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '48px 56px',
      }}>
        {/* Map-style background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #0F1F3D 0%, #0A1628 40%, #061018 100%)',
        }} />
        {/* Grid lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06 }}>
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#fff" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        {/* Block shapes */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.12 }}>
          <rect x="8%" y="12%" width="18%" height="10%" rx="2" fill="#A3B57A" />
          <rect x="28%" y="8%" width="12%" height="15%" rx="2" fill="#0EA5E9" opacity="0.7" />
          <rect x="42%" y="12%" width="22%" height="8%" rx="2" fill="#A3B57A" opacity="0.5" />
          <rect x="8%" y="28%" width="28%" height="18%" rx="2" fill="#0EA5E9" opacity="0.4" />
          <rect x="38%" y="24%" width="14%" height="10%" rx="2" fill="#8B5CF6" opacity="0.6" />
          <rect x="55%" y="18%" width="30%" height="22%" rx="2" fill="#A3B57A" opacity="0.3" />
          <line x1="0" y1="24%" x2="100%" y2="24%" stroke="#E5E7EB" strokeWidth="3" opacity="0.5" />
          <line x1="0" y1="48%" x2="100%" y2="48%" stroke="#E5E7EB" strokeWidth="2" opacity="0.3" />
          <line x1="36%" y1="0" x2="36%" y2="100%" stroke="#E5E7EB" strokeWidth="2" opacity="0.3" />
          <rect x="8%" y="52%" width="20%" height="30%" rx="2" fill="#166534" opacity="0.4" />
          <rect x="30%" y="56%" width="18%" height="20%" rx="2" fill="#F59E0B" opacity="0.3" />
          <rect x="52%" y="52%" width="12%" height="14%" rx="2" fill="#0EA5E9" opacity="0.4" />
        </svg>
        {/* Gradient overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(10,15,30,0.95) 0%, rgba(10,15,30,0.3) 60%, transparent 100%)',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28,
          }}>
            <div style={{
              width: 52, height: 52, background: '#A3B57A', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: 20, fontFamily: "'Inter Tight', sans-serif",
              flexShrink: 0,
            }}>UD</div>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>Urban Designer</span>
          </div>

          <h1 style={{ fontSize: 48, fontWeight: 800, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.03em', margin: '0 0 16px' }}>
            Design cities.<br />
            <span style={{ color: '#A3B57A' }}>On real maps.</span>
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', margin: '0 0 40px', maxWidth: 480, lineHeight: 1.6 }}>
            Professional urban planning tools for streets, buildings, parks, and transit. Built for planners, architects, and communities.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 460 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 16 }}>{f.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{f.title}</span>
                </div>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>{f.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: auth panel */}
      <div style={{
        background: '#fff', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '48px 40px',
        boxShadow: '-24px 0 80px rgba(0,0,0,0.4)',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderBottom: '1px solid #E5E7EB' }}>
          {(['signin', 'signup'] as AuthTab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(null); setSuccess(null) }} style={{
              flex: 1, height: 40, fontSize: 13, fontWeight: 600, border: 'none',
              background: 'none', cursor: 'pointer',
              color: tab === t ? '#1D4ED8' : '#6B7280',
              borderBottom: `2px solid ${tab === t ? '#1D4ED8' : 'transparent'}`,
              marginBottom: -1, transition: 'all 150ms',
            }}>
              {t === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tab === 'signup' && (
            <Field label="Full Name">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder="Jane Smith" required autoComplete="name"
                style={inputStyle} />
            </Field>
          )}
          <Field label="Email">
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com" required autoComplete="email"
              style={inputStyle} />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={tab === 'signup' ? 'At least 6 characters' : ''}
              required autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
              style={inputStyle} />
          </Field>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#DC2626' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#16A34A' }}>
              {success}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            height: 42, borderRadius: 8, border: 'none',
            background: loading ? '#93C5FD' : '#1D4ED8',
            color: '#fff', fontSize: 14, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: 4, transition: 'background 150ms',
          }}>
            {loading ? 'Please wait…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
          <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
        </div>

        <button onClick={handleGuest} style={{
          height: 42, borderRadius: 8, border: '1.5px solid #D1D5DB',
          background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', transition: 'border-color 150ms, background 150ms',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#9CA3AF'; e.currentTarget.style.background = '#F9FAFB' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#D1D5DB'; e.currentTarget.style.background = '#fff' }}
        >
          Continue as Guest
        </button>

        <p style={{ fontSize: 11, color: '#9CA3AF', textAlign: 'center', marginTop: 24, lineHeight: 1.5 }}>
          Guest projects are saved locally and not synced to the cloud.
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', height: 38, padding: '0 12px', fontSize: 13,
  borderRadius: 6, border: '1px solid #D1D5DB',
  background: '#F9FAFB', color: '#111827', outline: 'none',
  boxSizing: 'border-box',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</label>
      {children}
    </div>
  )
}
