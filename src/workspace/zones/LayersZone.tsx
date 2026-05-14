import React, { useState, useEffect } from 'react'
import { Icon } from '../components/Icon'
import { useLayersStore } from '../../store/layersStore'
import { useUIStore } from '../../store/uiStore'
import { useCanvasStore } from '../../store/canvasStore'

export function LayersZone() {
  const {
    order, groups, layers, selectedId, setSelectedId,
    toggleVisible, toggleLocked, toggleGroupCollapse,
    renameLayer, deleteLayer,
  } = useLayersStore()
  const { setSelectedIds, selectedIds, deleteFeatures, features } = useCanvasStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // Sync: when canvas features change, remove orphan layers
  useEffect(() => {
    const featureIds = new Set(features.map(f => f.properties.id))
    const orphans = layers.filter(l => l.elementId && !featureIds.has(l.elementId))
    orphans.forEach(l => deleteLayer(l.id))
  }, [features, layers, deleteLayer])

  // Sync: selecting a layer selects the feature on canvas
  function handleLayerClick(layerId: string, elementId: string) {
    setSelectedId(layerId)
    if (elementId) setSelectedIds([elementId])
  }

  // Delete layer → delete canvas feature
  function handleDeleteLayer(layerId: string, elementId: string) {
    deleteLayer(layerId)
    if (elementId) deleteFeatures([elementId])
    if (selectedId === layerId) setSelectedId(null)
  }

  function startRename(id: string, current: string) {
    setEditingId(id)
    setEditName(current)
  }
  function commitRename(id: string) {
    if (editName.trim()) renameLayer(id, editName.trim())
    setEditingId(null)
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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flex: 1 }}>{layers.length} layers</span>
        {selectedId && (() => {
          const layer = layers.find(l => l.id === selectedId)
          return layer ? (
            <button style={{ ...iconBtn, color: '#EF4444' }}
              onClick={() => handleDeleteLayer(selectedId, layer.elementId)}
              title="Delete layer and feature">
              <Icon name="trash" size={12} />
            </button>
          ) : null
        })()}
      </div>

      {/* Layer tree */}
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {order.map(item => {
          if (item.kind === 'group') {
            const group = groups.find(g => g.id === item.id)
            if (!group) return null
            return (
              <div key={item.id}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
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

            const isSelected = selectedId === item.id || (layer.elementId && selectedIds.includes(layer.elementId))

            return (
              <div key={item.id} style={rowStyle(!!isSelected)}
                onClick={() => handleLayerClick(item.id, layer.elementId)}
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

                <button style={{ ...iconBtn, color: '#EF4444', opacity: 0 }}
                  className="layer-delete-btn"
                  onClick={e => { e.stopPropagation(); handleDeleteLayer(item.id, layer.elementId) }}
                  title="Delete"
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>
                  <Icon name="trash" size={11} />
                </button>
              </div>
            )
          }

          return null
        })}

        {layers.length === 0 && (
          <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 11 }}>
            Draw elements to see layers
          </div>
        )}
      </div>
    </div>
  )
}
