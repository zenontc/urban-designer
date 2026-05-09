import { create } from 'zustand'

export interface LayerGroup {
  id: string
  label: string
  color: string
  collapsed: boolean
}

export interface LayerItem {
  id: string
  elementId: string
  label: string
  phase: string
  visible: boolean
  locked: boolean
  inMetrics: boolean
  groupId: string
}

export type OrderItem = { kind: 'group'; id: string } | { kind: 'layer'; id: string }

interface LayersState {
  groups: LayerGroup[]
  layers: LayerItem[]
  order: OrderItem[]
  selectedId: string | null

  setSelectedId: (id: string | null) => void
  toggleGroupCollapse: (id: string) => void
  toggleVisible: (id: string) => void
  toggleLocked: (id: string) => void
  toggleMetrics: (id: string) => void
  deleteLayer: (id: string) => void
  deleteGroup: (id: string) => void
  addGroup: (label: string) => void
  reorder: (order: OrderItem[]) => void
  renameLayer: (id: string, label: string) => void
  renameGroup: (id: string, label: string) => void
  addLayer: (layer: Omit<LayerItem, 'id'>) => void
}

const DEFAULT_GROUP: LayerGroup = { id: 'elements', label: 'Elements', color: '#2563EB', collapsed: false }

export const useLayersStore = create<LayersState>((set) => ({
  groups: [DEFAULT_GROUP],
  layers: [],
  order: [{ kind: 'group', id: 'elements' }],
  selectedId: null,

  setSelectedId: (id) => set({ selectedId: id }),
  toggleGroupCollapse: (id) => set((s) => ({ groups: s.groups.map(g => g.id === id ? { ...g, collapsed: !g.collapsed } : g) })),
  toggleVisible: (id) => set((s) => ({ layers: s.layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l) })),
  toggleLocked: (id) => set((s) => ({ layers: s.layers.map(l => l.id === id ? { ...l, locked: !l.locked } : l) })),
  toggleMetrics: (id) => set((s) => ({ layers: s.layers.map(l => l.id === id ? { ...l, inMetrics: !l.inMetrics } : l) })),
  deleteLayer: (id) => set((s) => ({ layers: s.layers.filter(l => l.id !== id), order: s.order.filter(o => !(o.kind === 'layer' && o.id === id)) })),
  deleteGroup: (id) => set((s) => ({ groups: s.groups.filter(g => g.id !== id), order: s.order.filter(o => !(o.kind === 'group' && o.id === id)) })),
  addGroup: (label) => set((s) => {
    const id = 'grp_' + Date.now()
    const palette = ['#7C3AED', '#DB2777', '#0891B2', '#BE185D', '#0E7490', '#65A30D']
    const newGroup: LayerGroup = { id, label, color: palette[s.groups.length % palette.length], collapsed: false }
    return { groups: [...s.groups, newGroup], order: [...s.order, { kind: 'group', id }] }
  }),
  reorder: (order) => set({ order }),
  renameLayer: (id, label) => set((s) => ({ layers: s.layers.map(l => l.id === id ? { ...l, label } : l) })),
  renameGroup: (id, label) => set((s) => ({ groups: s.groups.map(g => g.id === id ? { ...g, label } : g) })),
  addLayer: (layer) => set((s) => {
    const id = 'l_' + Date.now()
    const newLayer: LayerItem = { ...layer, id }
    const targetGroupIdx = [...s.order].reverse().findIndex((o: OrderItem) => o.kind === 'group' && o.id === layer.groupId)
    const revIdx = targetGroupIdx === -1 ? -1 : s.order.length - 1 - targetGroupIdx
    const insertIdx = revIdx === -1 ? s.order.length : revIdx + 1
    const newOrder = [...s.order]
    newOrder.splice(insertIdx, 0, { kind: 'layer', id })
    return { layers: [...s.layers, newLayer], order: newOrder }
  }),
}))
