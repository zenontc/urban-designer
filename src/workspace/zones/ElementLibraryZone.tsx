import React, { useState } from 'react'
import { useUIStore } from '../../store/uiStore'
import { ELEMENT_CATEGORIES } from '../../elements/categories'
import type { ElementTypeDefinition } from '../../elements/types'

// ── Thumbnail renderers ────────────────────────────────────────────────────

function TilePreview({ el }: { el: ElementTypeDefinition }) {
  const c = el.color ?? el.defaultStyle.strokeColor ?? '#6B7280'
  const fill = el.defaultStyle.fillColor ?? c
  const w = el.defaultStyle.strokeWidth ?? 1.5
  const id = el.id
  const cat = el.category.toLowerCase()

  // Street / road surface
  if (cat.includes('transportation') || id.includes('road') || id.includes('highway') || id.includes('lane')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#4B5563" />
        <rect x="0" y="14" width="44" height="16" fill="#374151" />
        <line x1="22" y1="14" x2="22" y2="30" stroke="#F59E0B" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="0" y1="14" x2="44" y2="14" stroke="#D1D5DB" strokeWidth="0.5" />
        <line x1="0" y1="30" x2="44" y2="30" stroke="#D1D5DB" strokeWidth="0.5" />
      </svg>
    )
  }

  // Street section / cross-section line
  if (cat.includes('street section') || id.includes('street-')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#F8FAFC" />
        <rect x="4" y="18" width="36" height="8" fill="#374151" rx="1" />
        <line x1="22" y1="18" x2="22" y2="26" stroke="#FCD34D" strokeWidth="0.75" strokeDasharray="2 2" />
        <line x1="4" y1="16" x2="4" y2="28" stroke="#6B7280" strokeWidth="1" />
        <line x1="40" y1="16" x2="40" y2="28" stroke="#6B7280" strokeWidth="1" />
        <line x1="4" y1="22" x2="1" y2="22" stroke="#6B7280" strokeWidth="0.75" />
        <line x1="40" y1="22" x2="43" y2="22" stroke="#6B7280" strokeWidth="0.75" />
      </svg>
    )
  }

  // Crosswalk
  if (id.includes('crosswalk') || id.includes('crossing')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#374151" />
        {[6, 12, 18, 24, 30, 36].map(x => (
          <rect key={x} x={x} y="12" width="4" height="20" fill="white" opacity="0.9" rx="0.5" />
        ))}
      </svg>
    )
  }

  // Road markings / arrows / lines
  if (cat.includes('marking') || id.includes('marking') || id.includes('arrow')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#374151" />
        <line x1="22" y1="6" x2="22" y2="30" stroke="white" strokeWidth="2" />
        <polyline points="16,24 22,34 28,24" fill="white" stroke="none" />
      </svg>
    )
  }

  // Parking
  if (cat.includes('parking') || id.includes('parking')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={`${fill}33`} />
        <rect x="4" y="4" width="36" height="36" rx="2" fill="none" stroke={c} strokeWidth="1" />
        {[10, 18, 26, 34].map(x => (
          <line key={x} x1={x} y1="4" x2={x} y2="40" stroke={c} strokeWidth="0.5" opacity="0.5" />
        ))}
        <text x="22" y="27" textAnchor="middle" fontSize="16" fontWeight="700" fill={c} fontFamily="sans-serif">P</text>
      </svg>
    )
  }

  // Transit (bus stop, station)
  if (cat.includes('transit') || id.includes('bus') || id.includes('station') || id.includes('transit')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={`${c}22`} />
        <rect x="12" y="10" width="20" height="22" rx="3" fill={c} opacity="0.9" />
        <rect x="14" y="14" width="7" height="5" rx="1" fill="white" opacity="0.8" />
        <rect x="23" y="14" width="7" height="5" rx="1" fill="white" opacity="0.8" />
        <rect x="14" y="26" width="4" height="3" rx="1" fill="white" opacity="0.6" />
        <rect x="26" y="26" width="4" height="3" rx="1" fill="white" opacity="0.6" />
        <rect x="14" y="32" width="16" height="2" rx="1" fill={c} opacity="0.4" />
      </svg>
    )
  }

  // Paths / sidewalks / bike lanes
  if (cat.includes('path') || id.includes('path') || id.includes('bike') || id.includes('sidewalk') || id.includes('trail')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={`${fill}22`} />
        <line x1="6" y1="22" x2="38" y2="22" stroke={c} strokeWidth={Math.max(w, 2)} strokeLinecap="round" strokeDasharray="6 4" />
      </svg>
    )
  }

  // Trees / planting
  if (cat.includes('planting') || id.includes('tree') || id.includes('shrub') || id.includes('hedge')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={`${fill}18`} />
        <circle cx="22" cy="20" r="11" fill={fill} opacity="0.85" />
        <circle cx="22" cy="20" r="11" fill="none" stroke={c} strokeWidth="1" />
        {[0, 60, 120, 180, 240, 300].map(deg => {
          const r = Math.PI * deg / 180
          return <line key={deg} x1="22" y1="20" x2={22 + 7 * Math.cos(r)} y2={20 + 7 * Math.sin(r)} stroke={c} strokeWidth="0.5" opacity="0.4" />
        })}
        <circle cx="22" cy="20" r="2" fill={c} opacity="0.6" />
      </svg>
    )
  }

  // Grass / ground surfaces / green infrastructure
  if (cat.includes('ground') || cat.includes('landscape') || cat.includes('green') || id.includes('grass') || id.includes('lawn') || id.includes('turf')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={fill} opacity="0.25" />
        <rect x="4" y="4" width="36" height="36" rx="3" fill="none" stroke={c} strokeWidth="1" />
        {[10, 16, 22, 28, 34].map(x =>
          [10, 18, 26, 34].map(y => (
            <line key={`${x}-${y}`} x1={x - 2} y1={y + 2} x2={x} y2={y - 2} stroke={c} strokeWidth="0.75" opacity="0.5" />
          ))
        )}
      </svg>
    )
  }

  // Street furniture (benches, lights, signs)
  if (cat.includes('furniture') || id.includes('bench') || id.includes('sign') || id.includes('bollard')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={`${c}18`} />
        <circle cx="22" cy="22" r="9" fill={c} opacity="0.15" stroke={c} strokeWidth="1.5" />
        <circle cx="22" cy="22" r="4" fill={c} opacity="0.7" />
      </svg>
    )
  }

  // Street lights / utilities
  if (id.includes('light') || id.includes('lamp') || cat.includes('utilities')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={`${c}18`} />
        <circle cx="22" cy="18" r="6" fill="#FCD34D" opacity="0.4" />
        <circle cx="22" cy="18" r="6" fill="none" stroke="#F59E0B" strokeWidth="1" />
        <circle cx="22" cy="18" r="2.5" fill="#F59E0B" />
        <line x1="22" y1="24" x2="22" y2="38" stroke={c} strokeWidth="1.5" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => {
          const r2 = Math.PI * deg / 180
          return <line key={deg} x1="22" y1="18" x2={22 + 9 * Math.cos(r2)} y2={18 + 9 * Math.sin(r2)} stroke="#FCD34D" strokeWidth="0.5" opacity="0.5" />
        })}
      </svg>
    )
  }

  // Buildings
  if (cat.includes('building') || id.includes('building') || id.includes('structure')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={`${fill}22`} />
        <rect x="8" y="8" width="28" height="28" fill={fill} stroke={c} strokeWidth="1.5" opacity="0.85" rx="1" />
        <line x1="8" y1="8" x2="12" y2="8" stroke={c} strokeWidth="2" />
        <line x1="8" y1="8" x2="8" y2="12" stroke={c} strokeWidth="2" />
        <line x1="36" y1="8" x2="32" y2="8" stroke={c} strokeWidth="2" />
        <line x1="36" y1="8" x2="36" y2="12" stroke={c} strokeWidth="2" />
        <line x1="8" y1="36" x2="12" y2="36" stroke={c} strokeWidth="2" />
        <line x1="8" y1="36" x2="8" y2="32" stroke={c} strokeWidth="2" />
        <line x1="36" y1="36" x2="32" y2="36" stroke={c} strokeWidth="2" />
        <line x1="36" y1="36" x2="36" y2="32" stroke={c} strokeWidth="2" />
      </svg>
    )
  }

  // Land use / zoning
  if (cat.includes('land use') || cat.includes('zoning') || id.includes('zone') || id.includes('land')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={fill} opacity="0.3" />
        <rect x="4" y="4" width="36" height="36" rx="3" fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="4 3" />
        <line x1="4" y1="4" x2="40" y2="40" stroke={c} strokeWidth="0.5" opacity="0.3" />
        <line x1="40" y1="4" x2="4" y2="40" stroke={c} strokeWidth="0.5" opacity="0.3" />
      </svg>
    )
  }

  // Actors (people, vehicles)
  if (cat.includes('actor') || id.includes('pedestrian') || id.includes('cyclist') || id.includes('vehicle')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={`${c}18`} />
        <circle cx="22" cy="14" r="5" fill={c} opacity="0.8" />
        <line x1="22" y1="19" x2="22" y2="31" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <line x1="14" y1="23" x2="30" y2="23" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <line x1="22" y1="31" x2="17" y2="38" stroke={c} strokeWidth="2" strokeLinecap="round" />
        <line x1="22" y1="31" x2="27" y2="38" stroke={c} strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  // Annotations / text
  if (cat.includes('annotation') || id.includes('text') || id.includes('label') || id.includes('arrow')) {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={`${c}12`} />
        <text x="22" y="26" textAnchor="middle" fontSize="20" fontWeight="700" fill={c} fontFamily="serif" opacity="0.85">Aa</text>
        <line x1="8" y1="32" x2="36" y2="32" stroke={c} strokeWidth="0.75" opacity="0.3" />
      </svg>
    )
  }

  // Generic line
  if (el.drawMode === 'line') {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={`${c}12`} />
        <line x1="6" y1="28" x2="38" y2="16" stroke={c} strokeWidth={Math.max(w, 2)} strokeLinecap="round" />
      </svg>
    )
  }

  // Generic place / point
  if (el.drawMode === 'place') {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={`${c}12`} />
        <circle cx="22" cy="19" r="8" fill={c} opacity="0.85" />
        <circle cx="22" cy="19" r="4" fill="white" opacity="0.5" />
        <ellipse cx="22" cy="34" rx="6" ry="2.5" fill={c} opacity="0.2" />
      </svg>
    )
  }

  // Generic polygon
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <rect width="44" height="44" rx="4" fill={`${fill}22`} />
      <rect x="7" y="7" width="30" height="30" rx="3" fill={fill} stroke={c} strokeWidth={Math.max(w, 1)} opacity="0.8" />
    </svg>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export function ElementLibraryZone() {
  const { setActiveElementType, activeElementType, setActiveTool } = useUIStore()
  // All categories expanded by default
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectElement(elId: string, drawMode: string) {
    setActiveElementType(elId)
    // Auto-switch to appropriate draw tool
    if (drawMode === 'polygon') setActiveTool('polygon')
    else if (drawMode === 'line') setActiveTool('line')
    else if (drawMode === 'place') setActiveTool('select')
    else setActiveTool('pen')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
      {ELEMENT_CATEGORIES.map(cat => {
        const isOpen = !collapsed.has(cat.id)
        return (
          <div key={cat.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
            <button
              onClick={() => toggle(cat.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text)',
                borderBottom: isOpen ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>{cat.label}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', flexShrink: 0, opacity: 0.4 }}>
                <polyline points="1,3 5,7 9,3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>

            {isOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, padding: '8px 8px 10px' }}>
                {cat.elements.map(el => {
                  const active = activeElementType === el.id
                  return (
                    <button
                      key={el.id}
                      onClick={() => selectElement(el.id, el.drawMode)}
                      title={el.label}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        padding: '6px 4px', borderRadius: 7, cursor: 'pointer',
                        border: `1.5px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
                        background: active ? 'var(--color-accent-subtle)' : 'transparent',
                        transition: 'all 100ms',
                      }}
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--color-bg-elevated)'; e.currentTarget.style.borderColor = 'var(--color-border)' } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}
                    >
                      <TilePreview el={el} />
                      <span style={{ fontSize: 9, color: active ? 'var(--color-accent)' : 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.2, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', fontWeight: active ? 600 : 400 }}>
                        {el.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
