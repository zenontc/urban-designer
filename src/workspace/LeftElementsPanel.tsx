import React from 'react'
import { ElementLibraryZone } from './zones/ElementLibraryZone'
import { useUIStore } from '../store/uiStore'

export function LeftElementsPanel() {
  const { showElementsPanel, toggleElementsPanel } = useUIStore()

  if (!showElementsPanel) return null

  return (
    <div style={{
      width: 280, minWidth: 280, flexShrink: 0,
      background: 'var(--color-bg-panel)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column',
      height: '100%', zIndex: 5,
    }}>
      {/* Header */}
      <div style={{
        height: 40, display: 'flex', alignItems: 'center',
        padding: '0 12px', borderBottom: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '0.02em' }}>
          Elements
        </span>
        <button
          onClick={toggleElementsPanel}
          style={{
            width: 22, height: 22, border: 'none', background: 'transparent',
            cursor: 'pointer', color: 'var(--color-text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 4, fontSize: 16, lineHeight: 1,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          ×
        </button>
      </div>

      {/* Library */}
      <ElementLibraryZone />
    </div>
  )
}
