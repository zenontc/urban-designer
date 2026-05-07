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

const INITIAL_GROUPS: LayerGroup[] = [
  { id: 'existing', label: 'Existing', color: '#94A3B8', collapsed: false },
  { id: 'phase1', label: 'Phase 1 — Near Term', color: '#2563EB', collapsed: false },
  { id: 'phase2', label: 'Phase 2 — Mid Term', color: '#16A34A', collapsed: true },
  { id: 'phase3', label: 'Phase 3 — Long Term', color: '#D97706', collapsed: true },
]

const SAMPLE_LAYERS: LayerItem[] = [
  { id: 'e1', elementId: 'e1', label: 'Main Street', phase: 'Existing', visible: true, locked: false, inMetrics: true, groupId: 'existing' },
  { id: 'e2', elementId: 'e2', label: 'Oak Avenue', phase: 'Existing', visible: true, locked: false, inMetrics: true, groupId: 'existing' },
  { id: 'e4', elementId: 'e4', label: 'Central Boulevard', phase: 'Existing', visible: true, locked: true, inMetrics: true, groupId: 'existing' },
  { id: 'e10', elementId: 'e10', label: 'Central Park Lawn', phase: 'Existing', visible: true, locked: false, inMetrics: true, groupId: 'existing' },
  { id: 'e3', elementId: 'e3', label: 'Protected Bike Lane', phase: 'Phase 1', visible: true, locked: false, inMetrics: true, groupId: 'phase1' },
  { id: 'e5', elementId: 'e5', label: 'North Sidewalk', phase: 'Phase 1', visible: true, locked: false, inMetrics: true, groupId: 'phase1' },
  { id: 'e6', elementId: 'e6', label: 'South Sidewalk', phase: 'Phase 1', visible: true, locked: false, inMetrics: true, groupId: 'phase1' },
  { id: 'e7', elementId: 'e7', label: 'Continental Crossing — Main/Oak', phase: 'Phase 1', visible: true, locked: false, inMetrics: true, groupId: 'phase1' },
  { id: 'e13', elementId: 'e13', label: 'Bus Stop — Main St', phase: 'Phase 1', visible: true, locked: false, inMetrics: true, groupId: 'phase1' },
  { id: 'e14', elementId: 'e14', label: 'Street Light Row', phase: 'Phase 1', visible: true, locked: false, inMetrics: true, groupId: 'phase1' },
  { id: 'e8', elementId: 'e8', label: 'Street Tree (Oak)', phase: 'Phase 2', visible: true, locked: false, inMetrics: true, groupId: 'phase2' },
  { id: 'e9', elementId: 'e9', label: 'Street Tree (Maple)', phase: 'Phase 2', visible: true, locked: false, inMetrics: true, groupId: 'phase2' },
  { id: 'e11', elementId: 'e11', label: 'Mixed-Use Block A', phase: 'Phase 2', visible: true, locked: false, inMetrics: true, groupId: 'phase2' },
  { id: 'e12', elementId: 'e12', label: 'Residential Tower', phase: 'Phase 3', visible: true, locked: false, inMetrics: true, groupId: 'phase3' },
]

function buildInitialOrder(): OrderItem[] {
  const out: OrderItem[] = []
  INITIAL_GROUPS.forEach(g => {
    out.push({ kind: 'group', id: g.id })
    SAMPLE_LAYERS.filter(l => l.groupId === g.id).forEach(l => out.push({ kind: 'layer', id: l.id }))
  })
  return out
}

export const useLayersStore = create<LayersState>((set) => ({
  groups: INITIAL_GROUPS,
  layers: SAMPLE_LAYERS,
  order: buildInitialOrder(),
  selectedId: 'e3',

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
