import React, { useState, useRef, useCallback } from 'react'
import { Icon } from './components/Icon'

interface Lane {
  id: string
  label: string
  width: number
  color: string
  icon: string
}

const DEFAULT_LANES: Lane[] = [
  { id: '1', label: 'Building Setback', width: 10, color: '#F1F5F9', icon: '🏠' },
  { id: '2', label: 'Sidewalk',         width: 12, color: '#E2E8F0', icon: '🚶' },
  { id: '3', label: 'Tree Buffer',      width: 6,  color: '#DCFCE7', icon: '🌳' },
  { id: '4', label: 'Bike Lane',        width: 6,  color: '#FEF9C3', icon: '🚲' },
  { id: '5', label: 'Travel Lane',      width: 12, color: '#CBD5E1', icon: '🚗' },
  { id: '6', label: 'Center Turn',      width: 10, color: '#DDD6FE', icon: '↔' },
  { id: '7', label: 'Travel Lane',      width: 12, color: '#CBD5E1', icon: '🚗' },
  { id: '8', label: 'Bike Lane',        width: 6,  color: '#FEF9C3', icon: '🚲' },
  { id: '9', label: 'Tree Buffer',      width: 6,  color: '#DCFCE7', icon: '🌳' },
  { id: '10', label: 'Sidewalk',        width: 12, color: '#E2E8F0', icon: '🚶' },
  { id: '11', label: 'Building Setback',width: 10, color: '#F1F5F9', icon: '🏠' },
]

interface CrossSectionEditorProps {
  onClose: () => void
}

export function CrossSectionEditor({ onClose }: CrossSectionEditorProps) {
  const [lanes, setLanes] = useState<Lane[]>(DEFAULT_LANES)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [units, setUnits] = useState<'ft' | 'm'>('ft')

  // Draggable panel
  const [pos, setPos] = useState({ x: 40, y: 40 })
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })

  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setPos({ x: ev.clientX - offset.current.x, y: ev.clientY - offset.current.y })
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos])

  const totalWidth = lanes.reduce((s, l) => s + l.width, 0)
  const conv = (w: number) => units === 'm' ? (w * 0.3048).toFixed(1) : w.toString()
  const selected = lanes.find(l => l.id === selectedId)

  function updateLane(id: string, patch: Partial<Lane>) {
    setLanes(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }
  function addLane() {
    const newId = Date.now().toString()
    setLanes(prev => [...prev, { id: newId, label: 'New Lane', width: 10, color: '#E2E8F0', icon: '➕' }])
    setSelectedId(newId)
  }
  function removeLane(id: string) {
    setLanes(prev => prev.filter(l => l.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  return (
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, zIndex: 200, width: 680, background: 'var(--color-bg-panel)', borderRadius: 10, border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(15,23,42,0.18)', userSelect: 'none' }}>
      {/* Header */}
      <div onMouseDown={onHeaderMouseDown} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--color-border)', cursor: 'grab', gap: 8 }}>
        <Icon name="road" size={14} color="var(--color-text-muted)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', flex: 1 }}>Street Cross-Section Editor</span>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginRight: 8 }}>ROW: {conv(totalWidth)}{units}</span>
        <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
          {(['ft', 'm'] as const).map(u => (
            <button key={u} onClick={() => setUnits(u)} style={{ padding: '2px 7px', fontSize: 10, fontWeight: u === units ? 700 : 400, background: u === units ? 'var(--color-accent)' : 'transparent', color: u === units ? '#fff' : 'var(--color-text-sec)', border: 'none', cursor: 'pointer' }}>{u}</button>
          ))}
        </div>
        <button onClick={onClose} style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* Cross-section diagram */}
      <div style={{ padding: '12px 12px 0', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 80, minWidth: 'max-content' }}>
          {lanes.map(lane => {
            const pxWidth = Math.max(30, (lane.width / totalWidth) * 600)
            return (
              <div key={lane.id} onClick={() => setSelectedId(lane.id === selectedId ? null : lane.id)} style={{
                width: pxWidth, flexShrink: 0, height: selectedId === lane.id ? 80 : 64,
                background: lane.color, borderLeft: selectedId === lane.id ? '2px solid var(--color-accent)' : '1px solid rgba(0,0,0,0.08)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 3, transition: 'height 150ms',
                borderRadius: selectedId === lane.id ? '3px 3px 0 0' : 0,
                boxSizing: 'border-box',
              }}>
                <span style={{ fontSize: 14 }}>{lane.icon}</span>
                <span style={{ fontSize: 8, color: '#475569', textAlign: 'center', lineHeight: 1.2, padding: '0 2px', maxWidth: pxWidth - 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lane.label}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#1E293B' }}>{conv(lane.width)}{units}</span>
              </div>
            )
          })}
        </div>
        {/* Ground line */}
        <div style={{ height: 3, background: '#334155', borderRadius: 2 }} />
      </div>

      {/* Editor panel */}
      <div style={{ padding: 12, display: 'flex', gap: 12 }}>
        {selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)' }}>Edit: {selected.label}</div>
            <Row label="Label">
              <input value={selected.label} onChange={e => updateLane(selected.id, { label: e.target.value })}
                style={{ flex: 1, height: 26, padding: '0 6px', fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 3, background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none' }} />
            </Row>
            <Row label={`Width (${units})`}>
              <input type="number" value={conv(selected.width)} step={units === 'ft' ? 1 : 0.3}
                onChange={e => updateLane(selected.id, { width: units === 'm' ? Number(e.target.value) / 0.3048 : Number(e.target.value) })}
                style={{ width: 64, height: 26, padding: '0 6px', fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 3, background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none' }} />
            </Row>
            <Row label="Color">
              <input type="color" value={selected.color} onChange={e => updateLane(selected.id, { color: e.target.value })}
                style={{ width: 32, height: 26, border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', padding: 2 }} />
            </Row>
            <button onClick={() => removeLane(selected.id)} style={{ alignSelf: 'flex-start', height: 24, padding: '0 10px', fontSize: 11, borderRadius: 3, border: '1px solid #FCA5A5', background: 'transparent', color: '#EF4444', cursor: 'pointer' }}>
              Remove Lane
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: 11 }}>
            Click a lane to edit it
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}>
          <button onClick={addLane} style={{ height: 28, padding: '0 10px', fontSize: 11, fontWeight: 500, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-sec)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Icon name="plus" size={12} /> Add Lane
          </button>
          <button style={{ height: 28, padding: '0 10px', fontSize: 11, fontWeight: 600, borderRadius: 4, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer' }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', width: 68, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  )
}
