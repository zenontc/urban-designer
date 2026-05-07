import React, { useState } from 'react'
import { ZoneHeader } from '../components/ZoneHeader'
import { Icon } from '../components/Icon'
import { useLayersStore } from '../../store/layersStore'
import { useUIStore } from '../../store/uiStore'

export function LayersZone() {
  const { zoneCollapsed, toggleZone } = useUIStore()
  const {
    order, groups, layers, selectedId, setSelectedId,
    toggleVisible, toggleLocked, toggleGroupCollapse,
    renameLayer, deleteLayer, addLayer,
  } = useLayersStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const collapsed = zoneCollapsed['layers']

  function startRename(id: string, current: string) {
    setEditingId(id)
    setEditName(current)
  }
  function commitRename(id: string) {
    if (editName.trim()) renameLayer(id, editName.trim())
    setEditingId(null)
  }
  function handleAddLayer() {
    const lastGroup = groups[groups.length - 1]
    if (!lastGroup) return
    addLayer({
      elementId: 'new_' + Date.now(),
      label: 'New Layer',
      phase: lastGroup.label,
      visible: true,
      locked: false,
      inMetrics: true,
      groupId: lastGroup.id,
    })
  }

  const rowStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 6px',
    cursor: 'pointer', userSelect: 'none',
    background: isSelected ? 'var(--color-accent-subtle)' : 'transparent',
    borderLeft: isSelected ? '2px solid var(--color-accent)' : '2px solid transparent',
  })

  const iconBtn: React.CSSProperties = {
    width: 20, height: 20, border: 'none', background: 'transparent',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 3, padding: 0, color: 'var(--color-text-muted)', flexShrink: 0,
  }

  return (
    <ZoneHeader label="Layers" collapsed={collapsed} onToggle={() => toggleZone('layers')}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--color-border)' }}>
        <button style={iconBtn} onClick={handleAddLayer} title="Add Layer">
          <Icon name="plus" size={13} />
        </button>
        <div style={{ flex: 1 }} />
        {selectedId && (
          <button style={{ ...iconBtn, color: '#EF4444' }} onClick={() => { deleteLayer(selectedId); setSelectedId(null) }} title="Delete">
            <Icon name="trash" size={12} />
          </button>
        )}
      </div>

      {/* Layer tree */}
      <div style={{ overflowY: 'auto', maxHeight: 240 }}>
        {order.map(item => {
          if (item.kind === 'group') {
            const group = groups.find(g => g.id === item.id)
            if (!group) return null
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: '#F8FAFC', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                onClick={() => toggleGroupCollapse(item.id)}>
                <Icon name={group.collapsed ? 'chevronRight' : 'chevronDown'} size={10} color="var(--color-text-muted)" />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: group.color, flexShrink: 0 }} />
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#64748B', flex: 1 }}>
                  {group.label}
                </span>
                <span style={{ fontSize: 9, color: 'var(--color-text-muted)' }}>
                  {layers.filter(l => l.groupId === item.id).length}
                </span>
              </div>
            )
          }

          if (item.kind === 'layer') {
            const layer = layers.find(l => l.id === item.id)
            if (!layer) return null

            const parentGroup = groups.find(g => g.id === layer.groupId)
            if (parentGroup?.collapsed) return null

            const isSelected = selectedId === item.id

            return (
              <div key={item.id} style={rowStyle(isSelected)} onClick={() => setSelectedId(item.id)}
                onDoubleClick={() => startRename(item.id, layer.label)}>
                <div style={{ width: 16, flexShrink: 0 }} />
                <div style={{ width: 8, height: 8, borderRadius: 1, background: parentGroup?.color ?? '#6366F1', flexShrink: 0, opacity: 0.7 }} />

                {editingId === item.id ? (
                  <input autoFocus value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onBlur={() => commitRename(item.id)}
                    onKeyDown={e => { if (e.key === 'Enter') commitRename(item.id); if (e.key === 'Escape') setEditingId(null) }}
                    style={{ flex: 1, fontSize: 11, padding: '1px 3px', border: '1px solid var(--color-accent)', borderRadius: 2, outline: 'none', background: 'var(--color-accent-subtle)' }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {layer.label}
                  </span>
                )}

                <button style={{ ...iconBtn, opacity: layer.visible ? 1 : 0.4 }}
                  onClick={e => { e.stopPropagation(); toggleVisible(item.id) }}
                  title={layer.visible ? 'Hide' : 'Show'}>
                  <Icon name={layer.visible ? 'eye' : 'eyeOff'} size={12} />
                </button>

                <button style={{ ...iconBtn, opacity: layer.locked ? 1 : 0.4 }}
                  onClick={e => { e.stopPropagation(); toggleLocked(item.id) }}
                  title={layer.locked ? 'Unlock' : 'Lock'}>
                  <Icon name={layer.locked ? 'lock' : 'unlock'} size={12} />
                </button>
              </div>
            )
          }

          return null
        })}
      </div>
    </ZoneHeader>
  )
}
