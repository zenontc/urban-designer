import React from 'react'
import { ZoneHeader } from '../components/ZoneHeader'
import { useUIStore } from '../../store/uiStore'
import type { ElementStyle } from '../../elements/types'

const PRESETS: Array<{ label: string; style: Partial<ElementStyle> }> = [
  { label: 'Street',    style: { strokeColor: '#374151', strokeWidth: 3, fillColor: '#6B7280', fillOpacity: 90 } },
  { label: 'Building',  style: { strokeColor: '#1E3A5F', strokeWidth: 1.5, fillColor: '#DBEAFE', fillOpacity: 80 } },
  { label: 'Park',      style: { strokeColor: '#166534', strokeWidth: 1, fillColor: '#DCFCE7', fillOpacity: 70 } },
  { label: 'Water',     style: { strokeColor: '#0369A1', strokeWidth: 1, fillColor: '#BAE6FD', fillOpacity: 60 } },
  { label: 'Parking',   style: { strokeColor: '#78350F', strokeWidth: 1, fillColor: '#FEF3C7', fillOpacity: 60 } },
  { label: 'Plaza',     style: { strokeColor: '#7C3AED', strokeWidth: 1, fillColor: '#EDE9FE', fillOpacity: 60 } },
]

export function StyleZone() {
  const { zoneCollapsed, toggleZone, activeStyle, setActiveStyle } = useUIStore()
  const collapsed = zoneCollapsed['style']

  return (
    <ZoneHeader label="Style" collapsed={collapsed} onToggle={() => toggleZone('style')}>
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Quick presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => setActiveStyle(p.style)} style={{
              height: 22, padding: '0 8px', fontSize: 10, fontWeight: 500,
              borderRadius: 3, border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text-sec)', cursor: 'pointer',
            }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Stroke row */}
        <Row label="Stroke">
          <ColorDot color={activeStyle.strokeColor} onChange={c => setActiveStyle({ strokeColor: c })} />
          <NumberInput value={activeStyle.strokeWidth} min={0} max={20} step={0.5}
            onChange={v => setActiveStyle({ strokeWidth: v })} suffix="px" />
        </Row>

        {/* Fill row */}
        <Row label="Fill">
          <ColorDot color={activeStyle.fillColor} onChange={c => setActiveStyle({ fillColor: c })} />
          <NumberInput value={activeStyle.fillOpacity} min={0} max={100} step={5}
            onChange={v => setActiveStyle({ fillOpacity: v })} suffix="%" />
        </Row>

        {/* Opacity row */}
        <Row label="Opacity">
          <input type="range" min={0} max={100} step={5} value={activeStyle.opacity * 100}
            onChange={e => setActiveStyle({ opacity: Number(e.target.value) / 100 })}
            style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 30, textAlign: 'right' }}>
            {Math.round(activeStyle.opacity * 100)}%
          </span>
        </Row>
      </div>
    </ZoneHeader>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 44, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  )
}

function ColorDot({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <label style={{ position: 'relative', cursor: 'pointer' }}>
      <div style={{ width: 20, height: 20, borderRadius: 4, background: color, border: '1.5px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
      <input type="color" value={color} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
    </label>
  )
}

function NumberInput({ value, min, max, step, onChange, suffix }: {
  value: number; min: number; max: number; step: number
  onChange: (v: number) => void; suffix?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
      <input type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', height: 24, padding: '0 4px', fontSize: 11, borderRadius: 3,
          border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)',
          color: 'var(--color-text)', outline: 'none',
        }} />
      {suffix && <span style={{ fontSize: 10, color: 'var(--color-text-muted)', flexShrink: 0 }}>{suffix}</span>}
    </div>
  )
}
