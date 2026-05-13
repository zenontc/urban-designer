import React, { useRef, useCallback, useState } from 'react'
import { useUIStore } from '../store/uiStore'
import { StyleZone } from './zones/StyleZone'
import { DetailsZone } from './zones/DetailsZone'
import { LayersZone } from './zones/LayersZone'
import { MetricsZone } from './zones/MetricsZone'

const MIN_PANEL_WIDTH = 260
const MAX_PANEL_WIDTH = 480

type Tab = 'style' | 'details' | 'layers' | 'metrics'

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  {
    id: 'style', label: 'Style',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" opacity=".5" /></svg>,
  },
  {
    id: 'details', label: 'Details',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
  },
  {
    id: 'layers', label: 'Layers',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 22 8.5 12 15 2 8.5" /><polyline points="2 15.5 12 22 22 15.5" /><polyline points="2 12 12 18.5 22 12" /></svg>,
  },
  {
    id: 'metrics', label: 'Metrics',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
  },
]

export function RightPanel() {
  const { rightPanelWidth, setRightPanelWidth } = useUIStore()
  const [activeTab, setActiveTab] = useState<Tab>('style')
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
        style={{ width: 4, cursor: 'col-resize', background: 'var(--color-border)', transition: 'background 150ms', flexShrink: 0 }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-accent)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-border)')}
      />

      {/* Panel */}
      <div style={{
        width: rightPanelWidth, flexShrink: 0,
        background: 'var(--color-bg-panel)',
        borderLeft: '1px solid var(--color-border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-panel)', flexShrink: 0,
        }}>
          {TABS.map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, height: 38, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                  border: 'none', borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                  background: 'transparent', cursor: 'pointer',
                  color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  fontSize: 10, fontWeight: active ? 600 : 400,
                  transition: 'color 120ms, border-color 120ms',
                  marginBottom: -1,
                }}
              >
                <span style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{tab.icon}</span>
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {activeTab === 'style'   && <StyleZone />}
          {activeTab === 'details' && <DetailsZone />}
          {activeTab === 'layers'  && <LayersZone />}
          {activeTab === 'metrics' && <MetricsZone />}
        </div>
      </div>
    </div>
  )
}
