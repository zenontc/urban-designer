import React, { useState } from 'react'
import { Icon } from './components/Icon'
import { useLayersStore } from '../store/layersStore'

const PHASE_COLORS: Record<string, string> = {
  existing: '#64748B',
  phase1:   '#2563EB',
  phase2:   '#16A34A',
  phase3:   '#D97706',
}

const PHASE_ICONS: Record<string, string> = {
  existing: '🏗',
  phase1:   '1️⃣',
  phase2:   '2️⃣',
  phase3:   '3️⃣',
}

export function ScenarioPanel({ onClose }: { onClose: () => void }) {
  const { groups, toggleGroupCollapse, renameGroup } = useLayersStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [activeScenario, setActiveScenario] = useState<string[]>(['existing', 'phase1', 'phase2', 'phase3'])

  function togglePhase(id: string) {
    setActiveScenario(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  function startRename(id: string, current: string) {
    setEditingId(id)
    setEditName(current)
  }

  function commitRename(id: string) {
    if (editName.trim()) renameGroup(id, editName.trim())
    setEditingId(null)
  }

  // Predefined scenario presets
  const PRESETS = [
    { label: 'Existing Only',    phases: ['existing'] },
    { label: 'Near-Term',        phases: ['existing', 'phase1'] },
    { label: 'Full Build-Out',   phases: ['existing', 'phase1', 'phase2', 'phase3'] },
    { label: 'Long-Range',       phases: ['existing', 'phase1', 'phase2', 'phase3'] },
  ]

  return (
    <div style={{
      position: 'absolute', top: 60, right: 340, zIndex: 200,
      width: 260, background: 'var(--color-bg-panel)',
      borderRadius: 10, border: '1px solid var(--color-border)',
      boxShadow: '0 8px 32px rgba(15,23,42,0.15)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--color-border)', gap: 8 }}>
        <Icon name="layers" size={14} color="var(--color-text-muted)" />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', flex: 1 }}>Scenario Manager</span>
        <button onClick={onClose} style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={14} />
        </button>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Phase visibility toggles */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>Phase Visibility</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {groups.map(group => {
              const isActive = activeScenario.includes(group.id)
              const color = PHASE_COLORS[group.id] ?? group.color
              return (
                <div key={group.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Toggle */}
                  <button onClick={() => togglePhase(group.id)} style={{
                    width: 36, height: 20, borderRadius: 10,
                    background: isActive ? color : 'var(--color-border)',
                    border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0,
                    transition: 'background 200ms',
                  }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: '50%', background: '#fff',
                      position: 'absolute', top: 3,
                      left: isActive ? 18 : 4, transition: 'left 200ms',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </button>

                  {/* Phase icon + name */}
                  <span style={{ fontSize: 13 }}>{PHASE_ICONS[group.id] ?? '📋'}</span>
                  {editingId === group.id ? (
                    <input autoFocus value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onBlur={() => commitRename(group.id)}
                      onKeyDown={e => { if (e.key === 'Enter') commitRename(group.id); if (e.key === 'Escape') setEditingId(null) }}
                      style={{ flex: 1, fontSize: 11, padding: '2px 4px', border: '1px solid var(--color-accent)', borderRadius: 3, outline: 'none', background: 'var(--color-accent-subtle)' }} />
                  ) : (
                    <span onDoubleClick={() => startRename(group.id, group.label)} style={{ flex: 1, fontSize: 11, color: isActive ? 'var(--color-text)' : 'var(--color-text-muted)', cursor: 'text', fontWeight: isActive ? 500 : 400 }}>
                      {group.label}
                    </span>
                  )}

                  {/* Collapse toggle */}
                  <button onClick={() => toggleGroupCollapse(group.id)} title={group.collapsed ? 'Show layers' : 'Collapse layers'} style={{ width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <Icon name={group.collapsed ? 'chevronRight' : 'chevronDown'} size={10} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Preset scenarios */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>Presets</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {PRESETS.map(preset => {
              const isActive = JSON.stringify([...activeScenario].sort()) === JSON.stringify([...preset.phases].sort())
              return (
              <button key={preset.label} onClick={() => setActiveScenario(preset.phases)} style={{
                height: 28, padding: '0 10px', textAlign: 'left', fontSize: 11, fontWeight: 500,
                borderRadius: 5, cursor: 'pointer', color: isActive ? 'var(--color-accent)' : 'var(--color-text-sec)',
                border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: isActive ? 'var(--color-accent-subtle)' : 'transparent',
              }}>
                {preset.label}
              </button>
            )})}

          </div>
        </div>

        {/* Feature count summary */}
        <div style={{ padding: '8px 10px', borderRadius: 6, background: 'var(--color-bg-elevated)', fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>
          {activeScenario.length} of {groups.length} phases visible
        </div>
      </div>
    </div>
  )
}
