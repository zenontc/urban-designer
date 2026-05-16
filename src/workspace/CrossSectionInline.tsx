import React, { useState, useEffect } from 'react'
import { Icon } from './components/Icon'
import type { UMPFeature } from '../store/canvasStore'

export interface StreetLane {
  id: string
  label: string
  width: number
  color: string
  icon: string
}

function makeLanes(specs: Array<[string, number, string, string]>): StreetLane[] {
  return specs.map(([label, width, color, icon], i) => ({ id: String(i + 1), label, width, color, icon }))
}

const LANES_BY_TYPE: Record<string, StreetLane[]> = {
  'alley': makeLanes([
    ['Travel Lane', 16, '#CBD5E1', '🚗'],
  ]),
  'bike-lane': makeLanes([
    ['Bike Lane', 8, '#FEF9C3', '🚲'],
  ]),
  'shared-path': makeLanes([
    ['Shared Path', 12, '#DCFCE7', '🚶'],
  ]),
  'ped-street': makeLanes([
    ['Sidewalk', 5, '#E2E8F0', '🚶'],
    ['Pedestrian Zone', 20, '#F0FDF4', '🚶'],
    ['Sidewalk', 5, '#E2E8F0', '🚶'],
  ]),
  'local-street': makeLanes([
    ['Sidewalk', 7.5, '#E2E8F0', '🚶'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Center Turn', 6, '#DDD6FE', '↔'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Sidewalk', 7.5, '#E2E8F0', '🚶'],
  ]),
  'collector-street': makeLanes([
    ['Sidewalk', 8, '#E2E8F0', '🚶'],
    ['Parking', 8, '#F1F5F9', '🅿'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Center Turn', 12, '#DDD6FE', '↔'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Parking', 8, '#F1F5F9', '🅿'],
  ]),
  'arterial': makeLanes([
    ['Sidewalk', 10, '#E2E8F0', '🚶'],
    ['Bike Lane', 6, '#FEF9C3', '🚲'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Center Turn', 10, '#DDD6FE', '↔'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Bike Lane', 6, '#FEF9C3', '🚲'],
    ['Sidewalk', 10, '#E2E8F0', '🚶'],
  ]),
  'highway': makeLanes([
    ['Setback', 34, '#F1F5F9', '🏠'],
    ['Shoulder', 12, '#94A3B8', '⚠'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Median', 36, '#DCFCE7', '🌳'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Travel Lane', 12, '#CBD5E1', '🚗'],
    ['Shoulder', 12, '#94A3B8', '⚠'],
    ['Setback', 34, '#F1F5F9', '🏠'],
  ]),
}

const DEFAULT_LANES = LANES_BY_TYPE['arterial']

export function defaultLanesForType(elementType: string): StreetLane[] {
  return LANES_BY_TYPE[elementType] ?? DEFAULT_LANES
}

interface CrossSectionInlineProps {
  feature: UMPFeature
  onUpdate: (lanes: StreetLane[]) => void
}

function defaultLanesForFeature(feature: UMPFeature): StreetLane[] {
  if (feature.properties.streetLanes) return feature.properties.streetLanes
  return LANES_BY_TYPE[feature.properties.elementType] ?? DEFAULT_LANES
}

export function CrossSectionInline({ feature, onUpdate }: CrossSectionInlineProps) {
  const [lanes, setLanes] = useState<StreetLane[]>(() => defaultLanesForFeature(feature))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [units, setUnits] = useState<'ft' | 'm'>('ft')

  // Sync when feature changes (different street selected)
  useEffect(() => {
    setLanes(defaultLanesForFeature(feature))
    setSelectedId(null)
  }, [feature.properties.id])

  const totalWidth = lanes.reduce((s, l) => s + l.width, 0)
  const conv = (w: number) => units === 'm' ? (w * 0.3048).toFixed(1) : w.toString()
  const selected = lanes.find(l => l.id === selectedId)

  function updateLane(id: string, patch: Partial<StreetLane>) {
    setLanes(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l))
  }
  function addLane() {
    const newId = Date.now().toString()
    const newLanes: StreetLane[] = [...lanes, { id: newId, label: 'New Lane', width: 10, color: '#E2E8F0', icon: '➕' }]
    setLanes(newLanes)
    setSelectedId(newId)
  }
  function removeLane(id: string) {
    setLanes(prev => prev.filter(l => l.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function handleApply() {
    onUpdate(lanes)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', gap: 8 }}>
        <Icon name="road" size={13} color="var(--color-text-muted)" />
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', flex: 1 }}>Cross-Section</span>
        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginRight: 4 }}>ROW: {conv(totalWidth)}{units}</span>
        <div style={{ display: 'flex', border: '1px solid var(--color-border)', borderRadius: 4, overflow: 'hidden' }}>
          {(['ft', 'm'] as const).map(u => (
            <button key={u} onClick={() => setUnits(u)} style={{
              padding: '2px 6px', fontSize: 10, fontWeight: u === units ? 700 : 400,
              background: u === units ? 'var(--color-accent)' : 'transparent',
              color: u === units ? '#fff' : 'var(--color-text-sec)',
              border: 'none', cursor: 'pointer',
            }}>{u}</button>
          ))}
        </div>
      </div>

      {/* Cross-section diagram */}
      <div style={{ padding: '0 12px', overflowX: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 72, minWidth: 'max-content' }}>
          {lanes.map(lane => {
            const pxWidth = Math.max(22, (lane.width / totalWidth) * 220)
            const isSelected = selectedId === lane.id
            return (
              <div
                key={lane.id}
                onClick={() => setSelectedId(isSelected ? null : lane.id)}
                style={{
                  width: pxWidth, flexShrink: 0, height: isSelected ? 72 : 58,
                  background: lane.color,
                  borderLeft: isSelected ? '2px solid var(--color-accent)' : '1px solid rgba(0,0,0,0.08)',
                  cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                  transition: 'height 150ms',
                  borderRadius: isSelected ? '3px 3px 0 0' : 0,
                  boxSizing: 'border-box',
                }}
              >
                <span style={{ fontSize: 10 }}>{lane.icon}</span>
                <span style={{ fontSize: 7, color: '#475569', textAlign: 'center', lineHeight: 1.2, padding: '0 2px', maxWidth: pxWidth - 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lane.label}</span>
                <span style={{ fontSize: 8, fontWeight: 700, color: '#1E293B' }}>{conv(lane.width)}{units}</span>
              </div>
            )
          })}
        </div>
        <div style={{ height: 3, background: '#334155', borderRadius: 2 }} />
      </div>

      {/* Editor panel */}
      <div style={{ padding: '8px 12px', display: 'flex', gap: 8 }}>
        {selected ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text)' }}>Edit: {selected.label}</div>
            <Row label="Label">
              <input value={selected.label} onChange={e => updateLane(selected.id, { label: e.target.value })}
                style={{ flex: 1, height: 24, padding: '0 6px', fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 3, background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none' }} />
            </Row>
            <Row label={`Width (${units})`}>
              <input type="number" value={conv(selected.width)} step={units === 'ft' ? 1 : 0.3}
                onChange={e => updateLane(selected.id, { width: units === 'm' ? Number(e.target.value) / 0.3048 : Number(e.target.value) })}
                style={{ width: 56, height: 24, padding: '0 6px', fontSize: 11, border: '1px solid var(--color-border)', borderRadius: 3, background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none' }} />
            </Row>
            <Row label="Color">
              <input type="color" value={selected.color} onChange={e => updateLane(selected.id, { color: e.target.value })}
                style={{ width: 28, height: 24, border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', padding: 2 }} />
            </Row>
            <button onClick={() => removeLane(selected.id)} style={{ alignSelf: 'flex-start', height: 22, padding: '0 8px', fontSize: 10, borderRadius: 3, border: '1px solid #FCA5A5', background: 'transparent', color: '#EF4444', cursor: 'pointer' }}>
              Remove Lane
            </button>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)', fontSize: 10 }}>
            Click a lane to edit it
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, justifyContent: 'flex-end' }}>
          <button onClick={addLane} style={{ height: 26, padding: '0 8px', fontSize: 10, fontWeight: 500, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-sec)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Icon name="plus" size={11} /> Add Lane
          </button>
          <button onClick={handleApply} style={{ height: 26, padding: '0 8px', fontSize: 10, fontWeight: 600, borderRadius: 4, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer' }}>
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
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 60, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  )
}
