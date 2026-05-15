import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Icon } from '../components/Icon'
import { useLayersStore } from '../../store/layersStore'
import { useUIStore } from '../../store/uiStore'
import { useCanvasStore } from '../../store/canvasStore'
import type { OrderItem } from '../../store/layersStore'

export function LayersZone() {
  const {
    order, groups, layers, selectedId, setSelectedId,
    toggleVisible, toggleLocked, toggleGroupCollapse,
    renameLayer, deleteLayer, reorder,
  } = useLayersStore()
  const { setSelectedIds, selectedIds, deleteFeatures, features, reorderFeatures } = useCanvasStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([])

  // Drag state
  const dragLayerId = useRef<string | null>(null)
  const dragOverLayerId = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  // Sync: when canvas features change, remove orphan layers
  useEffect(() => {
    const featureIds = new Set(features.map(f => f.properties.id))
    const orphans = layers.filter(l => l.elementId && !featureIds.has(l.elementId))
    orphans.forEach(l => deleteLayer(l.id))
  }, [features, layers, deleteLayer])

  // Sync multi-select to canvas selectedIds
  function handleLayerClick(layerId: string, elementId: string, e: React.MouseEvent) {
    if (e.shiftKey) {
      // Shift+click: toggle in multi-select
      const newIds = selectedLayerIds.includes(layerId)
        ? selectedLayerIds.filter(id => id !== layerId)
        : [...selectedLayerIds, layerId]
      setSelectedLayerIds(newIds)
      setSelectedId(layerId)
      const elemIds = newIds
        .map(id => layers.find(l => l.id === id)?.elementId)
        .filter((id): id is string => !!id)
      setSelectedIds(elemIds)
    } else {
      setSelectedLayerIds([layerId])
      setSelectedId(layerId)
      if (elementId) setSelectedIds([elementId])
    }
  }

  // Delete selected layers
  function handleDeleteLayer(layerId: string, elementId: string) {
    const toDelete = selectedLayerIds.includes(layerId) ? selectedLayerIds : [layerId]
    toDelete.forEach(id => {
      const layer = layers.find(l => l.id === id)
      if (layer) {
        deleteLayer(id)
        if (layer.elementId) deleteFeatures([layer.elementId])
      }
    })
    setSelectedLayerIds([])
    if (selectedId && toDelete.includes(selectedId)) setSelectedId(null)
  }

  function moveLayer(layerId: string, dir: 1 | -1) {
    const layerItems = order.filter((o): o is OrderItem & { kind: 'layer' } => o.kind === 'layer')
    const idx = layerItems.findIndex(o => o.id === layerId)
    const newIdx = idx + dir
    if (newIdx < 0 || newIdx >= layerItems.length) return

    const fullIdxA = order.findIndex(o => o.kind === 'layer' && o.id === layerItems[idx].id)
    const fullIdxB = order.findIndex(o => o.kind === 'layer' && o.id === layerItems[newIdx].id)
    const newOrder = [...order]
    ;[newOrder[fullIdxA], newOrder[fullIdxB]] = [newOrder[fullIdxB], newOrder[fullIdxA]]
    reorder(newOrder)

    const newLayerItems = newOrder.filter((o): o is OrderItem & { kind: 'layer' } => o.kind === 'layer')
    const featureIds = newLayerItems
      .map(o => layers.find(l => l.id === o.id)?.elementId)
      .filter((id): id is string => !!id)
    reorderFeatures(featureIds)
  }

  // Drag-and-drop reordering
  const handleDragStart = useCallback((e: React.DragEvent, layerId: string) => {
    dragLayerId.current = layerId
    setDraggingId(layerId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', layerId)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, layerId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverLayerId.current = layerId
    setDragOverId(layerId)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetLayerId: string) => {
    e.preventDefault()
    const sourceId = dragLayerId.current
    if (!sourceId || sourceId === targetLayerId) {
      setDraggingId(null)
      setDragOverId(null)
      return
    }

    const layerItems = order.filter((o): o is OrderItem & { kind: 'layer' } => o.kind === 'layer')
    const sourceIdx = layerItems.findIndex(o => o.id === sourceId)
    const targetIdx = layerItems.findIndex(o => o.id === targetLayerId)
    if (sourceIdx === -1 || targetIdx === -1) return

    // Build new order: remove source, insert at target position
    const newLayerItems = [...layerItems]
    const [removed] = newLayerItems.splice(sourceIdx, 1)
    newLayerItems.splice(targetIdx, 0, removed)

    // Rebuild full order preserving groups
    const newOrder: OrderItem[] = []
    let layerIdx = 0
    for (const item of order) {
      if (item.kind === 'group') {
        newOrder.push(item)
      } else {
        newOrder.push(newLayerItems[layerIdx++])
      }
    }

    reorder(newOrder)
    const featureIds = newLayerItems
      .map(o => layers.find(l => l.id === o.id)?.elementId)
      .filter((id): id is string => !!id)
    reorderFeatures(featureIds)

    dragLayerId.current = null
    dragOverLayerId.current = null
    setDraggingId(null)
    setDragOverId(null)
  }, [order, layers, reorder, reorderFeatures])

  const handleDragEnd = useCallback(() => {
    dragLayerId.current = null
    dragOverLayerId.current = null
    setDraggingId(null)
    setDragOverId(null)
  }, [])

  function startRename(id: string, current: string) {
    setEditingId(id)
    setEditName(current)
  }
  function commitRename(id: string) {
    if (editName.trim()) renameLayer(id, editName.trim())
    setEditingId(null)
  }

  const isLayerSelected = (layerId: string, elementId: string) =>
    selectedLayerIds.includes(layerId) ||
    selectedId === layerId ||
    (elementId && selectedIds.includes(elementId))

  const rowStyle = (isSelected: boolean, isDragging: boolean, isDragOver: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 6px',
    cursor: 'pointer', userSelect: 'none',
    background: isDragOver ? 'var(--color-accent-subtle)' : isSelected ? 'var(--color-accent-subtle)' : 'transparent',
    borderLeft: isSelected ? '2px solid var(--color-accent)' : isDragOver ? '2px solid var(--color-accent)' : '2px solid transparent',
    opacity: isDragging ? 0.4 : 1,
    transition: 'border-color 0.1s, background 0.1s',
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
        {selectedLayerIds.length > 1 && (
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginRight: 4 }}>{selectedLayerIds.length} selected</span>
        )}
        {(selectedId || selectedLayerIds.length > 0) && (() => {
          const id = selectedLayerIds.length > 0 ? selectedLayerIds[0] : selectedId!
          const layer = layers.find(l => l.id === id)
          return layer ? (
            <button style={{ ...iconBtn, color: '#EF4444' }}
              onClick={() => handleDeleteLayer(id, layer.elementId)}
              title="Delete layer(s)">
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

            const isSelected = !!isLayerSelected(item.id, layer.elementId)
            const isDragging = draggingId === item.id
            const isDragOver = dragOverId === item.id && draggingId !== item.id

            return (
              <div
                key={item.id}
                style={rowStyle(isSelected, isDragging, isDragOver)}
                draggable
                onDragStart={e => handleDragStart(e, item.id)}
                onDragOver={e => handleDragOver(e, item.id)}
                onDrop={e => handleDrop(e, item.id)}
                onDragEnd={handleDragEnd}
                onClick={e => handleLayerClick(item.id, layer.elementId, e)}
                onDoubleClick={() => startRename(item.id, layer.label)}
              >
                {/* Drag handle */}
                <div style={{ cursor: 'grab', color: 'var(--color-text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', opacity: 0.4 }}
                  title="Drag to reorder">
                  <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
                    <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
                    <circle cx="2" cy="6" r="1.2" /><circle cx="6" cy="6" r="1.2" />
                    <circle cx="2" cy="10" r="1.2" /><circle cx="6" cy="10" r="1.2" />
                  </svg>
                </div>

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

                <button style={{ ...iconBtn }}
                  onClick={e => { e.stopPropagation(); moveLayer(item.id, -1) }}
                  title="Move up">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,7 5,3 8,7" /></svg>
                </button>
                <button style={{ ...iconBtn }}
                  onClick={e => { e.stopPropagation(); moveLayer(item.id, 1) }}
                  title="Move down">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="2,3 5,7 8,3" /></svg>
                </button>

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

                <button style={{ ...iconBtn, color: '#EF4444' }}
                  onClick={e => { e.stopPropagation(); handleDeleteLayer(item.id, layer.elementId) }}
                  title="Delete">
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
