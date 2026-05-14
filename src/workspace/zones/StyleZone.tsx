import React from 'react'
import { useUIStore } from '../../store/uiStore'
import { useCanvasStore } from '../../store/canvasStore'
import type { ElementStyle } from '../../elements/types'

const DASH_PATTERNS: Array<{ label: string; value: number[] }> = [
  { label: 'Solid',     value: [] },
  { label: 'Dashed',    value: [8, 4] },
  { label: 'Dotted',    value: [2, 4] },
  { label: 'Dash-dot',  value: [8, 4, 2, 4] },
  { label: 'Long dash', value: [16, 6] },
]

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48]

export function StyleZone() {
  const { activeStyle, setActiveStyle } = useUIStore()
  const { features, selectedIds, updateFeature } = useCanvasStore()

  const selectedFeature = selectedIds.length === 1
    ? features.find(f => f.properties.id === selectedIds[0])
    : null
  const s: ElementStyle = selectedFeature ? selectedFeature.properties.style : activeStyle

  const isLine = selectedFeature?.geometry.type === 'LineString'
  const isText = selectedFeature?.properties.elementType === 'text'
  const isPoint = selectedFeature?.geometry.type === 'Point' && !isText

  function set(patch: Partial<ElementStyle>) {
    if (selectedFeature) {
      updateFeature(selectedFeature.properties.id, {
        style: { ...selectedFeature.properties.style, ...patch }
      })
    } else {
      setActiveStyle({ ...s, ...patch })
    }
  }

  return (
    <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Stroke */}
      {!isText && (
        <Section label="Stroke">
          <Row label="Color">
            <ColorDot color={s.strokeColor} onChange={c => set({ strokeColor: c })} />
          </Row>
          <Row label="Width">
            <input type="range" min={0.5} max={12} step={0.5} value={s.strokeWidth}
              onChange={e => set({ strokeWidth: Number(e.target.value) })}
              style={{ flex: 1 }} />
            <Num>{s.strokeWidth}px</Num>
          </Row>
        </Section>
      )}

      {/* Fill */}
      {!isLine && !isText && (
        <>
          <div style={{ height: 1, background: 'var(--color-border)' }} />
          <Section label="Fill">
            <Row label="Color">
              <ColorDot color={s.fillColor} onChange={c => set({ fillColor: c })} />
            </Row>
            <Row label="Opacity">
              <input type="range" min={0} max={100} step={5} value={s.fillOpacity}
                onChange={e => set({ fillOpacity: Number(e.target.value) })}
                style={{ flex: 1 }} />
              <Num>{s.fillOpacity}%</Num>
            </Row>
          </Section>
        </>
      )}

      {/* Line style */}
      {!isText && !isPoint && (
        <>
          <div style={{ height: 1, background: 'var(--color-border)' }} />
          <Section label="Line">
            <Row label="Pattern">
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {DASH_PATTERNS.map(dp => {
                  const active = JSON.stringify(s.dashArray) === JSON.stringify(dp.value)
                  return (
                    <button key={dp.label} onClick={() => set({ dashArray: dp.value })} title={dp.label} style={{
                      width: 34, height: 22, borderRadius: 3, cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
                      background: active ? 'var(--color-accent-subtle)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="24" height="8" viewBox="0 0 24 8">
                        <line x1="1" y1="4" x2="23" y2="4" stroke="var(--color-text)" strokeWidth="1.5"
                          strokeDasharray={dp.value.length > 0 ? dp.value.join(' ') : undefined} />
                      </svg>
                    </button>
                  )
                })}
              </div>
            </Row>
            <Row label="Cap">
              <div style={{ display: 'flex', gap: 3 }}>
                {(['butt', 'round', 'square'] as const).map(cap => (
                  <button key={cap} onClick={() => set({ lineCap: cap })} style={{
                    height: 24, padding: '0 7px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                    border: `1px solid ${s.lineCap === cap ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: s.lineCap === cap ? 'var(--color-accent-subtle)' : 'transparent',
                    color: s.lineCap === cap ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    fontWeight: s.lineCap === cap ? 600 : 400,
                  }}>
                    {cap[0].toUpperCase() + cap.slice(1)}
                  </button>
                ))}
              </div>
            </Row>
            <Row label="Join">
              <div style={{ display: 'flex', gap: 3 }}>
                {(['miter', 'round', 'bevel'] as const).map(join => (
                  <button key={join} onClick={() => set({ lineJoin: join })} style={{
                    height: 24, padding: '0 7px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
                    border: `1px solid ${s.lineJoin === join ? 'var(--color-accent)' : 'var(--color-border)'}`,
                    background: s.lineJoin === join ? 'var(--color-accent-subtle)' : 'transparent',
                    color: s.lineJoin === join ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    fontWeight: s.lineJoin === join ? 600 : 400,
                  }}>
                    {join[0].toUpperCase() + join.slice(1)}
                  </button>
                ))}
              </div>
            </Row>
          </Section>
        </>
      )}

      {/* Text */}
      {isText && (
        <>
          <div style={{ height: 1, background: 'var(--color-border)' }} />
          <Section label="Text">
            <Row label="Color">
              <ColorDot color={s.strokeColor} onChange={c => set({ strokeColor: c })} />
            </Row>
            <Row label="Size">
              <select value={s.fontSize} onChange={e => set({ fontSize: Number(e.target.value) })} style={{
                flex: 1, height: 26, padding: '0 4px', fontSize: 11, borderRadius: 3,
                border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)',
                color: 'var(--color-text)', cursor: 'pointer',
              }}>
                {FONT_SIZES.map(sz => <option key={sz} value={sz}>{sz}px</option>)}
              </select>
            </Row>
            <Row label="Weight">
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => set({ fontWeight: s.fontWeight === 700 ? 400 : 700 })} style={{
                  width: 30, height: 26, borderRadius: 3, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                  border: `1px solid ${s.fontWeight === 700 ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: s.fontWeight === 700 ? 'var(--color-accent-subtle)' : 'transparent',
                  color: s.fontWeight === 700 ? 'var(--color-accent)' : 'var(--color-text-muted)',
                }}>B</button>
                <button onClick={() => set({ fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic' })} style={{
                  width: 30, height: 26, borderRadius: 3, cursor: 'pointer', fontStyle: 'italic', fontSize: 13,
                  border: `1px solid ${s.fontStyle === 'italic' ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: s.fontStyle === 'italic' ? 'var(--color-accent-subtle)' : 'transparent',
                  color: s.fontStyle === 'italic' ? 'var(--color-accent)' : 'var(--color-text-muted)',
                }}>I</button>
              </div>
            </Row>
          </Section>
        </>
      )}

    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>{label}</span>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 44, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>{children}</div>
    </div>
  )
}

function ColorDot({ color, onChange }: { color: string; onChange: (c: string) => void }) {
  return (
    <label style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 22, height: 22, borderRadius: 4, background: color, border: '1.5px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{color}</span>
      <input type="color" value={color} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
    </label>
  )
}

function Num({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 10, color: 'var(--color-text-muted)', minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{children}</span>
}
