import React from 'react'

interface LandingPageProps {
  onNavigate: (page: string) => void
}

export function LandingPage({ onNavigate }: LandingPageProps) {
  return (
    <div style={{ width: '100vw', height: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, background: '#A3B57A', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 24, fontFamily: "'Inter Tight', sans-serif" }}>
          UD
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em', margin: 0 }}>
          Urban Designer
        </h1>
        <p style={{ fontSize: 18, color: 'var(--color-text-muted)', maxWidth: 480, margin: 0 }}>
          Professional urban planning and design on real satellite maps.
          Draw streets, buildings, parks, and more.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => onNavigate('workspace')} style={{ height: 44, padding: '0 28px', fontSize: 15, fontWeight: 700, borderRadius: 8, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer' }}>
          Start Designing
        </button>
        <button onClick={() => onNavigate('dashboard')} style={{ height: 44, padding: '0 28px', fontSize: 15, fontWeight: 600, borderRadius: 8, border: '1.5px solid var(--color-border)', background: 'transparent', color: 'var(--color-text)', cursor: 'pointer' }}>
          View Projects
        </button>
      </div>
    </div>
  )
}
