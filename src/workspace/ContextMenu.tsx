import React, { useEffect, useRef } from 'react'
import { Icon } from './components/Icon'
import { useCanvasStore } from '../store/canvasStore'
import { useUIStore } from '../store/uiStore'

interface ContextMenuProps {
  x: number
  y: number
  featureId: string | null
  onClose: () => void
}

export function ContextMenu({ x, y, featureId, onClose }: ContextMenuProps) {
  const { features, deleteFeature, addFeature, selectedIds, setSelectedIds } = useCanvasStore()
  const { setActiveElementType } = useUIStore()
  const ref = useRef<HTMLDivElement>(null)

  const feature = featureId ? features.find(f => f.properties.id === featureId) : null

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [onClose])

  // Adjust position so menu doesn't go off-screen
  const adjustedX = Math.min(x, window.innerWidth - 180)
  const adjustedY = Math.min(y, window.innerHeight - 240)

  function duplicate() {
    if (!feature) return
    const now = new Date().toISOString()
    const newId = 'f_' + Math.random().toString(36).slice(2, 10)
    addFeature({
      ...feature,
      id: newId,
      properties: { ...feature.properties, id: newId, label: feature.properties.label + ' (copy)', createdAt: now, updatedAt: now },
    })
    onClose()
  }

  function remove() {
    if (!featureId) return
    deleteFeature(featureId)
    setSelectedIds(selectedIds.filter(id => id !== featureId))
    onClose()
  }

  function selectAll() {
    setSelectedIds(features.map(f => f.properties.id))
    onClose()
  }

  function viewDetails() {
    if (feature) setActiveElementType(feature.properties.elementType)
    onClose()
  }

  const sep = { height: 1, background: 'var(--color-border)', margin: '3px 0' }

  const item = (icon: string, label: string, onClick: () => void, danger = false): React.ReactNode => (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 14px', fontSize: 12, cursor: 'pointer',
      color: danger ? '#EF4444' : 'var(--color-text)',
      borderRadius: 4, margin: '1px 4px',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? '#FEE2E2' : 'var(--color-bg-elevated)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      <Icon name={icon} size={13} color={danger ? '#EF4444' : 'var(--color-text-sec)'} />
      {label}
    </div>
  )

  return (
    <div ref={ref} style={{
      position: 'fixed', left: adjustedX, top: adjustedY, zIndex: 9999,
      background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)',
      borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.16)',
      minWidth: 168, padding: '4px 0', userSelect: 'none',
    }}>
      {feature && (
        <>
          <div style={{ padding: '5px 14px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
            {feature.properties.label}
          </div>
          <div style={sep} />
          {item('info', 'View Details', viewDetails)}
          {item('copy', 'Duplicate', duplicate)}
          {item('sliders', 'Edit Style', onClose)}
          <div style={sep} />
          {item('trash', 'Delete', remove, true)}
          <div style={sep} />
        </>
      )}
      {item('select', 'Select All', selectAll)}
      {item('x', 'Deselect All', () => { setSelectedIds([]); onClose() })}
    </div>
  )
}
