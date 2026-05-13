import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UMPFeatureProperties } from '../elements/types'

export type UMPFeature = GeoJSON.Feature<GeoJSON.Geometry, UMPFeatureProperties>

const MAX_HISTORY = 50

interface CanvasState {
  features: UMPFeature[]
  selectedIds: string[]
  history: UMPFeature[][]
  historyIndex: number

  addFeature: (feature: UMPFeature) => void
  updateFeature: (id: string, props: Partial<UMPFeatureProperties>) => void
  updateGeometry: (id: string, geometry: GeoJSON.Geometry) => void
  deleteFeature: (id: string) => void
  deleteFeatures: (ids: string[]) => void
  setSelectedIds: (ids: string[]) => void
  setFeatures: (features: UMPFeature[]) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean
}

function pushHistory(history: UMPFeature[][], historyIndex: number, features: UMPFeature[]) {
  const newHistory = history.slice(0, historyIndex + 1)
  newHistory.push(features)
  if (newHistory.length > MAX_HISTORY) newHistory.shift()
  return { history: newHistory, historyIndex: newHistory.length - 1 }
}

function makeId() {
  return 'f_' + Math.random().toString(36).slice(2, 10)
}

export function makeFeature(
  geometry: GeoJSON.Geometry,
  elementType: string,
  category: string,
  partial?: Partial<UMPFeatureProperties>,
): UMPFeature {
  const now = new Date().toISOString()
  return {
    type: 'Feature',
    id: makeId(),
    geometry,
    properties: {
      id: makeId(),
      elementType,
      category,
      label: elementType,
      phase: 'phase-1',
      status: 'proposed',
      layerGroup: 'phase1',
      zIndex: 0,
      visible: true,
      locked: false,
      inMetrics: true,
      style: {
        strokeColor: '#2563EB',
        strokeWidth: 2,
        strokeOpacity: 1,
        fillColor: '#EFF6FF',
        fillOpacity: 70,
        lineType: 'solid',
        dashLength: 8,
        gapLength: 4,
        dashArray: [],
        lineCap: 'round',
        lineJoin: 'round',
        arrowStart: 'none',
        arrowEnd: 'none',
        opacity: 1,
        fontSize: 14,
        fontWeight: 400,
        fontStyle: 'normal',
        fontFamily: 'Inter',
      },
      createdAt: now,
      updatedAt: now,
      ...partial,
    },
  }
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      features: [],
      selectedIds: [],
      history: [[]],
      historyIndex: 0,

      addFeature: (feature) =>
        set((s) => {
          const next = [...s.features, feature]
          return { features: next, ...pushHistory(s.history, s.historyIndex, next) }
        }),

      updateFeature: (id, props) =>
        set((s) => {
          const next = s.features.map((f) =>
            f.properties.id === id
              ? { ...f, properties: { ...f.properties, ...props, updatedAt: new Date().toISOString() } }
              : f,
          )
          return { features: next, ...pushHistory(s.history, s.historyIndex, next) }
        }),

      updateGeometry: (id, geometry) =>
        set((s) => {
          const next = s.features.map((f) =>
            f.properties.id === id ? { ...f, geometry } : f,
          )
          return { features: next, ...pushHistory(s.history, s.historyIndex, next) }
        }),

      deleteFeature: (id) =>
        set((s) => {
          const next = s.features.filter((f) => f.properties.id !== id)
          return { features: next, ...pushHistory(s.history, s.historyIndex, next) }
        }),

      deleteFeatures: (ids) =>
        set((s) => {
          const next = s.features.filter((f) => !ids.includes(f.properties.id))
          return { features: next, ...pushHistory(s.history, s.historyIndex, next) }
        }),

      setSelectedIds: (ids) => set({ selectedIds: ids }),

      setFeatures: (features) =>
        set((s) => ({ features, ...pushHistory(s.history, s.historyIndex, features) })),

      bringToFront: (id) =>
        set((s) => {
          const idx = s.features.findIndex(f => f.properties.id === id)
          if (idx < 0 || idx === s.features.length - 1) return s
          const next = [...s.features]
          next.push(next.splice(idx, 1)[0])
          return { features: next, ...pushHistory(s.history, s.historyIndex, next) }
        }),

      sendToBack: (id) =>
        set((s) => {
          const idx = s.features.findIndex(f => f.properties.id === id)
          if (idx <= 0) return s
          const next = [...s.features]
          next.unshift(next.splice(idx, 1)[0])
          return { features: next, ...pushHistory(s.history, s.historyIndex, next) }
        }),

      undo: () =>
        set((s) => {
          if (s.historyIndex <= 0) return s
          const historyIndex = s.historyIndex - 1
          return { features: s.history[historyIndex], historyIndex }
        }),

      redo: () =>
        set((s) => {
          if (s.historyIndex >= s.history.length - 1) return s
          const historyIndex = s.historyIndex + 1
          return { features: s.history[historyIndex], historyIndex }
        }),

      canUndo: () => get().historyIndex > 0,
      canRedo: () => get().historyIndex < get().history.length - 1,
    }),
    {
      name: 'ump-canvas',
      partialize: (state) => ({ features: state.features }),
    },
  ),
)
