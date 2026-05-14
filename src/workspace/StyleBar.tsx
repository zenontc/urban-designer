import React, { useRef, useState } from 'react'
import { Icon } from './components/Icon'
import { Tooltip } from './components/Tooltip'
import { useUIStore } from '../store/uiStore'
import { useCanvasStore } from '../store/canvasStore'
import type { ElementStyle } from '../elements/types'

const STROKE_COLORS = ['#0EA5E9','#22C55E','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#0F172A','#64748B','#FFFFFF']
const FILL_COLORS   = [...STROKE_COLORS]
const STROKE_WIDTHS = [0.5, 1, 1.5, 2, 3, 4, 6, 8]
const DASH_PATTERNS: Array<{ label: string; value: number[] }> = [
  { label: 'Solid',       value: [] },
  { label: 'Dashed',      value: [8, 4] },
  { label: 'Dotted',      value: [2, 4] },
  { label: 'Dash-dot',    value: [8, 4, 2, 4] },
  { label: 'Long dash',   value: [16, 6] },
]
const OPACITIES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

type Popover = 'stroke' | 'fill' | 'width' | 'dash' | 'opacity' | null

function Swatch({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return (
    <div onClick={onClick} style={{
      width: 18, height: 18, borderRadius: 3, background: color, cursor: 'pointer',
      border: active ? '2px solid var(--color-accent)' : '1.5px solid rgba(0,0,0,0.12)',
      boxSizing: 'border-box', flexShrink: 0,
    }} />
  )
}

function PopoverPanel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      position: 'absolute', top: 'calc(100% + 6px)', left: 0,
      background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)',
      borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.14)',
      padding: 10, zIndex: 9999, ...style,
    }}>
      {children}
    </div>
  )
}

function StyleButton({ label, onClick, active, children }: { label: string; onClick: () => void; active: boolean; children: React.ReactNode }) {
  return (
    <Tooltip label={label} placement="bottom">
      <button onClick={onClick} style={{
        height: 26, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 5,
        borderRadius: 4, border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border)'}`,
        background: active ? 'var(--color-accent-subtle)' : 'transparent',
        cursor: 'pointer', color: 'var(--color-text-sec)', fontSize: 11, fontWeight: 500,
      }}>
        {children}
      </button>
    </Tooltip>
  )
}

export function StyleBar() {
  const { activeStyle, setActiveStyle } = useUIStore()
  const { features, selectedIds } = useCanvasStore()
  const [open, setOpen] = useState<Popover>(null)
  const barRef = useRef<HTMLDivElement>(null)

  const selFeat = selectedIds.length === 1 ? features.find(f => f.properties.id === selectedIds[0]) : null
  const isLine = selFeat?.geometry.type === 'LineString'
  const isText = selFeat?.properties.elementType === 'text'
  const isPoint = selFeat?.geometry.type === 'Point' && !isText

  function update(patch: Partial<ElementStyle>) {
    setActiveStyle({ ...activeStyle, ...patch })
  }

  function toggle(panel: Popover) {
    setOpen(prev => (prev === panel ? null : panel))
  }

  const s = activeStyle

  return (
    <div ref={barRef} style={{
      height: 36, background: 'var(--color-bg-panel)', borderBottom: '1px solid var(--color-border)',
      display: 'flex', alignItems: 'center', paddingLeft: 56, paddingRight: 12, gap: 6,
      position: 'relative', zIndex: 50, flexShrink: 0,
    }}
      onMouseLeave={() => setOpen(null)}
    >
      {/* Stroke Color — hidden for text */}
      {!isText && <div style={{ position: 'relative' }}>
        <StyleButton label="Stroke Color" onClick={() => toggle('stroke')} active={open === 'stroke'}>
          <div style={{ width: 14, height: 14, borderRadius: 2, background: s.strokeColor, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
          <span>Stroke</span>
        </StyleButton>
        {open === 'stroke' && (
          <PopoverPanel style={{ width: 160 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {STROKE_COLORS.map(c => (
                <Swatch key={c} color={c} active={s.strokeColor === c} onClick={() => { update({ strokeColor: c }); setOpen(null) }} />
              ))}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Custom</span>
              <input type="color" value={s.strokeColor} onChange={e => update({ strokeColor: e.target.value })}
                style={{ width: 28, height: 22, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 3 }} />
            </div>
          </PopoverPanel>
        )}
      </div>}

      {/* Fill Color — hidden for lines and text */}
      {!isLine && !isText && <div style={{ position: 'relative' }}>
        <StyleButton label="Fill Color" onClick={() => toggle('fill')} active={open === 'fill'}>
          <div style={{ width: 14, height: 14, borderRadius: 2, background: s.fillColor, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
          <span>Fill</span>
        </StyleButton>
        {open === 'fill' && (
          <PopoverPanel style={{ width: 160 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {FILL_COLORS.map(c => (
                <Swatch key={c} color={c} active={s.fillColor === c} onClick={() => { update({ fillColor: c }); setOpen(null) }} />
              ))}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Custom</span>
              <input type="color" value={s.fillColor} onChange={e => update({ fillColor: e.target.value })}
                style={{ width: 28, height: 22, border: 'none', padding: 0, cursor: 'pointer', borderRadius: 3 }} />
            </div>
          </PopoverPanel>
        )}
      </div>}

      {/* Fill Opacity — hidden for lines and text */}
      {!isLine && !isText && <div style={{ position: 'relative' }}>
        <StyleButton label="Fill Opacity" onClick={() => toggle('opacity')} active={open === 'opacity'}>
          <Icon name="opacity" size={13} />
          <span>{s.fillOpacity}%</span>
        </StyleButton>
        {open === 'opacity' && (
          <PopoverPanel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {OPACITIES.map(o => (
                <div key={o} onClick={() => { update({ fillOpacity: o }); setOpen(null) }} style={{
                  padding: '3px 8px', borderRadius: 3, cursor: 'pointer', fontSize: 12,
                  background: s.fillOpacity === o ? 'var(--color-accent-subtle)' : 'transparent',
                  color: s.fillOpacity === o ? 'var(--color-accent)' : 'var(--color-text)',
                  fontWeight: s.fillOpacity === o ? 600 : 400,
                }}>
                  {o}%
                </div>
              ))}
            </div>
          </PopoverPanel>
        )}
      </div>}

      {!isLine && !isText && <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />}

      {/* Stroke Width — hidden for text */}
      {!isText && <div style={{ position: 'relative' }}>
        <StyleButton label="Stroke Width" onClick={() => toggle('width')} active={open === 'width'}>
          <Icon name="strokeWidth" size={13} />
          <span>{s.strokeWidth}px</span>
        </StyleButton>
        {open === 'width' && (
          <PopoverPanel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {STROKE_WIDTHS.map(w => (
                <div key={w} onClick={() => { update({ strokeWidth: w }); setOpen(null) }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '3px 6px',
                  borderRadius: 3, cursor: 'pointer',
                  background: s.strokeWidth === w ? 'var(--color-accent-subtle)' : 'transparent',
                }}>
                  <div style={{ width: 48, height: w, background: 'var(--color-text)', borderRadius: w / 2, minHeight: 1 }} />
                  <span style={{ fontSize: 11, color: 'var(--color-text-sec)', minWidth: 24 }}>{w}px</span>
                </div>
              ))}
            </div>
          </PopoverPanel>
        )}
      </div>}

      {/* Dash Pattern — hidden for text and points */}
      {!isText && !isPoint && <div style={{ position: 'relative' }}>
        <StyleButton label="Line Style" onClick={() => toggle('dash')} active={open === 'dash'}>
          <svg width="20" height="10" viewBox="0 0 20 10">
            {s.dashArray.length === 0
              ? <line x1="1" y1="5" x2="19" y2="5" stroke="currentColor" strokeWidth="1.5" />
              : <line x1="1" y1="5" x2="19" y2="5" stroke="currentColor" strokeWidth="1.5"
                  strokeDasharray={s.dashArray.join(' ')} />}
          </svg>
        </StyleButton>
        {open === 'dash' && (
          <PopoverPanel style={{ minWidth: 140 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {DASH_PATTERNS.map(dp => (
                <div key={dp.label} onClick={() => { update({ dashArray: dp.value }); setOpen(null) }} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px',
                  borderRadius: 3, cursor: 'pointer',
                  background: JSON.stringify(s.dashArray) === JSON.stringify(dp.value) ? 'var(--color-accent-subtle)' : 'transparent',
                }}>
                  <svg width="40" height="10" viewBox="0 0 40 10">
                    <line x1="1" y1="5" x2="39" y2="5" stroke="var(--color-text)" strokeWidth="1.5"
                      strokeDasharray={dp.value.length > 0 ? dp.value.join(' ') : undefined} />
                  </svg>
                  <span style={{ fontSize: 11, color: 'var(--color-text-sec)' }}>{dp.label}</span>
                </div>
              ))}
            </div>
          </PopoverPanel>
        )}
      </div>}

      {/* Text styles — only for text elements */}
      {isText && <>
        <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />
        <Tooltip label="Font Size" placement="bottom">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-text-sec)' }}>
            <Icon name="text" size={13} />
            <select value={s.fontSize} onChange={e => update({ fontSize: Number(e.target.value) })} style={{
              height: 24, padding: '0 4px', fontSize: 11, borderRadius: 4,
              border: '1px solid var(--color-border)', background: 'var(--color-bg-panel)',
              color: 'var(--color-text)', cursor: 'pointer',
            }}>
              {[8,9,10,11,12,14,16,18,20,24,28,32,36,48,64].map(sz => (
                <option key={sz} value={sz}>{sz}</option>
              ))}
            </select>
          </div>
        </Tooltip>
        <Tooltip label="Bold" placement="bottom">
          <button onClick={() => update({ fontWeight: s.fontWeight === 700 ? 400 : 700 })} style={{
            width: 26, height: 26, borderRadius: 4, border: `1px solid ${s.fontWeight === 700 ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: s.fontWeight === 700 ? 'var(--color-accent-subtle)' : 'transparent',
            cursor: 'pointer', fontWeight: 700, fontSize: 13, color: s.fontWeight === 700 ? 'var(--color-accent)' : 'var(--color-text-sec)',
          }}>B</button>
        </Tooltip>
        <Tooltip label="Italic" placement="bottom">
          <button onClick={() => update({ fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic' })} style={{
            width: 26, height: 26, borderRadius: 4, border: `1px solid ${s.fontStyle === 'italic' ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: s.fontStyle === 'italic' ? 'var(--color-accent-subtle)' : 'transparent',
            cursor: 'pointer', fontStyle: 'italic', fontSize: 13, color: s.fontStyle === 'italic' ? 'var(--color-accent)' : 'var(--color-text-sec)',
          }}>I</button>
        </Tooltip>
      </>}

      {!isText && !isPoint && <div style={{ width: 1, height: 20, background: 'var(--color-border)' }} />}

      {/* Line Cap / Join — hidden for text and points */}
      {!isText && !isPoint && <>
        <Tooltip label="Round Cap" placement="bottom">
          <button onClick={() => update({ lineCap: s.lineCap === 'round' ? 'butt' : 'round' })} style={{
            width: 26, height: 26, borderRadius: 4, border: `1px solid ${s.lineCap === 'round' ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: s.lineCap === 'round' ? 'var(--color-accent-subtle)' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-sec)',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <line x1="2" y1="7" x2="12" y2="7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </button>
        </Tooltip>

        <Tooltip label="Miter Join" placement="bottom">
          <button onClick={() => update({ lineJoin: s.lineJoin === 'miter' ? 'round' : 'miter' })} style={{
            width: 26, height: 26, borderRadius: 4, border: `1px solid ${s.lineJoin === 'miter' ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: s.lineJoin === 'miter' ? 'var(--color-accent-subtle)' : 'transparent',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--color-text-sec)',
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <polyline points="2,12 7,2 12,12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="miter" />
            </svg>
          </button>
        </Tooltip>
      </>}

    </div>
  )
}
