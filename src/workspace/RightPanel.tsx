import React, { useRef, useCallback } from 'react'
import { useUIStore } from '../store/uiStore'
import { StyleZone } from './zones/StyleZone'
import { ElementLibraryZone } from './zones/ElementLibraryZone'
import { DetailsZone } from './zones/DetailsZone'
import { LayersZone } from './zones/LayersZone'
import { MetricsZone } from './zones/MetricsZone'

const MIN_PANEL_WIDTH = 260
const MAX_PANEL_WIDTH = 480

export function RightPanel() {
  const { rightPanelWidth, setRightPanelWidth } = useUIStore()
  const dragging = useRef(false)
  const startX = useRef(0)
  const startW = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    startX.current = e.clientX
    startW.current = rightPanelWidth

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return
      const delta = startX.current - ev.clientX
      const newW = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, startW.current + delta))
      setRightPanelWidth(newW)
    }
    function onUp() {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [rightPanelWidth, setRightPanelWidth])

  return (
    <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
      {/* Drag handle */}
      <div
        onMouseDown={onMouseDown}
        style={{
          width: 4, cursor: 'col-resize', background: 'var(--color-border)',
          transition: 'background 150ms',
          flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-accent)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-border)')}
      />

      {/* Panel */}
      <div style={{
        width: rightPanelWidth, flexShrink: 0,
        background: 'var(--color-bg-panel)',
        borderLeft: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', overflowX: 'hidden',
      }}>
        <StyleZone />
        <ElementLibraryZone />
        <DetailsZone />
        <LayersZone />
        <MetricsZone />
      </div>
    </div>
  )
}
