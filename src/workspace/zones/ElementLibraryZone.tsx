import React, { useState } from 'react'
import { ZoneHeader } from '../components/ZoneHeader'
import { useUIStore } from '../../store/uiStore'
import { ELEMENT_CATEGORIES } from '../../elements/categories'
import type { ElementTypeDefinition } from '../../elements/types'

function TilePreview({ el }: { el: ElementTypeDefinition }) {
  const style = el.defaultStyle
  const color = el.color ?? style.strokeColor ?? '#6B7280'
  const fill = style.fillColor ?? color

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" style={{ display: 'block' }}>
      <rect width="44" height="44" rx="4" fill={`${fill}22`} />
      {el.drawMode === 'line' ? (
        <line x1="6" y1="22" x2="38" y2="22" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      ) : el.drawMode === 'place' ? (
        <>
          <circle cx="22" cy="18" r="7" fill={color} opacity={0.9} />
          <ellipse cx="22" cy="34" rx="5" ry="2" fill={color} opacity={0.2} />
        </>
      ) : (
        <rect x="8" y="8" width="28" height="28" rx="3" fill={fill} stroke={color} strokeWidth={1.5} opacity={0.85} />
      )}
    </svg>
  )
}

export function ElementLibraryZone() {
  const { zoneCollapsed, toggleZone, setActiveElementType } = useUIStore()
  const [selectedCat, setSelectedCat] = useState(ELEMENT_CATEGORIES[0].id)
  const [search, setSearch] = useState('')
  const collapsed = zoneCollapsed['library']

  const category = ELEMENT_CATEGORIES.find(c => c.id === selectedCat)!
  const filtered = search.trim()
    ? ELEMENT_CATEGORIES.flatMap(c => c.elements).filter(e =>
        e.label.toLowerCase().includes(search.toLowerCase()))
    : category.elements

  return (
    <ZoneHeader label="Element Library" collapsed={collapsed} onToggle={() => toggleZone('library')}>
      {/* Category tabs */}
      <div style={{ borderBottom: '1px solid var(--color-border)', overflowX: 'auto', display: 'flex' }}>
        {ELEMENT_CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => { setSelectedCat(cat.id); setSearch('') }} title={cat.label} style={{
            flexShrink: 0, width: 36, height: 32, border: 'none', cursor: 'pointer',
            background: selectedCat === cat.id && !search ? 'var(--color-accent-subtle)' : 'transparent',
            borderBottom: selectedCat === cat.id && !search ? '2px solid var(--color-accent)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, transition: 'all 100ms',
          }}>
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '6px 10px', borderBottom: '1px solid var(--color-border)' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search elements…"
          style={{
            width: '100%', height: 26, padding: '0 8px', fontSize: 11, borderRadius: 4,
            border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)',
            color: 'var(--color-text)', outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Category label */}
      {!search && (
        <div style={{ padding: '4px 10px 2px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: category.color }}>
          {category.label}
        </div>
      )}

      {/* Tiles grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 6, padding: '6px 10px 10px', maxHeight: 240, overflowY: 'auto' }}>
        {filtered.map(el => (
          <button
            key={el.id}
            onClick={() => setActiveElementType(el.id)}
            title={el.label}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              padding: '4px 2px', borderRadius: 6, border: '1px solid transparent',
              background: 'transparent', cursor: 'pointer',
              transition: 'all 100ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg-elevated)'; e.currentTarget.style.borderColor = 'var(--color-border)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' }}
          >
            <TilePreview el={el} />
            <span style={{ fontSize: 9, color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.2, maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
              {el.label}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', padding: '12px 0', textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
            No results
          </div>
        )}
      </div>
    </ZoneHeader>
  )
}
