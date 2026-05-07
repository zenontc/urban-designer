import React, { useState } from 'react'

interface DashboardProps {
  onNavigate: (page: string) => void
}

const SAMPLE_PROJECTS = [
  { id: '1', name: 'Downtown Corridor Study', updatedAt: '2 hours ago', thumbnail: '#A3B57A' },
  { id: '2', name: 'Riverfront District Plan', updatedAt: '1 day ago', thumbnail: '#0EA5E9' },
  { id: '3', name: 'Transit Hub Redevelopment', updatedAt: '3 days ago', thumbnail: '#8B5CF6' },
  { id: '4', name: 'Mixed-Use Block Proposal', updatedAt: '1 week ago', thumbnail: '#F59E0B' },
]

export function Dashboard({ onNavigate }: DashboardProps) {
  const [search, setSearch] = useState('')

  const filtered = SAMPLE_PROJECTS.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  const s = {
    page: { width: '100vw', height: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' as const },
    header: { height: 56, background: 'var(--color-bg-panel)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', paddingLeft: 24, paddingRight: 24, gap: 16 },
    logo: { width: 36, height: 36, background: '#A3B57A', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, fontFamily: "'Inter Tight', sans-serif" },
    main: { flex: 1, padding: '32px 48px', overflowY: 'auto' as const },
    card: (color: string): React.CSSProperties => ({ width: 220, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border)', background: 'var(--color-bg-panel)', cursor: 'pointer', transition: 'box-shadow 150ms' }),
    thumb: (bg: string): React.CSSProperties => ({ height: 130, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 32 }),
    cardBody: { padding: '10px 14px 12px' },
  }

  return (
    <div style={s.page}>
      <header style={s.header}>
        <div style={s.logo}>UD</div>
        <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>Urban Designer</span>
        <div style={{ flex: 1 }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search projects…"
          style={{ height: 32, width: 220, padding: '0 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none' }} />
        <button onClick={() => onNavigate('workspace')} style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer' }}>
          New Project
        </button>
      </header>

      <main style={s.main}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', marginBottom: 24 }}>My Projects</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
          {filtered.map(p => (
            <div key={p.id} style={s.card(p.thumbnail)} onClick={() => onNavigate('workspace')}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}>
              <div style={s.thumb(p.thumbnail)}>🗺</div>
              <div style={s.cardBody}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginBottom: 3 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Edited {p.updatedAt}</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No projects found</div>
          )}
        </div>
      </main>
    </div>
  )
}
