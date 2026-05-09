import { create } from 'zustand'
import type { ElementStyle } from '../elements/types'

export type ToolId =
  | 'pan' | 'select' | 'direct' | 'pen' | 'line' | 'rect' | 'ellipse' | 'polygon'
  | 'addNode' | 'delNode' | 'scissors' | 'text' | 'dimension' | 'measure' | 'extrude'

const DEFAULT_STYLE: ElementStyle = {
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
}

interface PanelZoneHeights {
  style: number
  library: number
  details: number
  layers: number
  metrics: number
}

interface UIState {
  activeTool: ToolId
  activeElementType: string | null
  activeStyle: ElementStyle
  nightMode: boolean
  mode3D: boolean
  showShadowPanel: boolean
  showShareModal: boolean
  showMetricsPanel: boolean
  showCanvasSearch: boolean
  showElementsPanel: boolean
  canvasSearchQuery: string
  rightPanelWidth: number
  panelZoneHeights: PanelZoneHeights
  zoneCollapsed: Record<string, boolean>
  units: 'ft' | 'm'

  setActiveTool: (tool: ToolId) => void
  setActiveElementType: (type: string | null) => void
  setActiveStyle: (style: Partial<ElementStyle>) => void
  setNightMode: (v: boolean) => void
  setMode3D: (v: boolean) => void
  toggleShadowPanel: () => void
  toggleShareModal: () => void
  toggleMetricsPanel: () => void
  toggleCanvasSearch: () => void
  toggleElementsPanel: () => void
  setCanvasSearchQuery: (q: string) => void
  setRightPanelWidth: (w: number) => void
  toggleZone: (zone: string) => void
  setUnits: (u: 'ft' | 'm') => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTool: 'select',
  activeElementType: null,
  activeStyle: DEFAULT_STYLE,
  nightMode: false,
  mode3D: false,
  showShadowPanel: false,
  showShareModal: false,
  showMetricsPanel: false,
  showCanvasSearch: false,
  showElementsPanel: false,
  canvasSearchQuery: '',
  rightPanelWidth: 320,
  panelZoneHeights: { style: 20, library: 30, details: 25, layers: 15, metrics: 10 },
  zoneCollapsed: { style: false, library: true, details: true, layers: true, metrics: true },
  units: 'ft',

  setActiveTool: (tool) => set({ activeTool: tool }),
  setActiveElementType: (type) => set({ activeElementType: type }),
  setActiveStyle: (partial) => set((s) => ({ activeStyle: { ...s.activeStyle, ...partial } })),
  setNightMode: (v) => set({ nightMode: v }),
  setMode3D: (v) => set({ mode3D: v }),
  toggleShadowPanel: () => set((s) => ({ showShadowPanel: !s.showShadowPanel })),
  toggleShareModal: () => set((s) => ({ showShareModal: !s.showShareModal })),
  toggleMetricsPanel: () => set((s) => ({ showMetricsPanel: !s.showMetricsPanel })),
  toggleCanvasSearch: () => set((s) => ({ showCanvasSearch: !s.showCanvasSearch, canvasSearchQuery: '' })),
  toggleElementsPanel: () => set((s) => ({ showElementsPanel: !s.showElementsPanel })),
  setCanvasSearchQuery: (q) => set({ canvasSearchQuery: q }),
  setRightPanelWidth: (w) => set({ rightPanelWidth: Math.min(480, Math.max(260, w)) }),
  toggleZone: (zone) => set((s) => ({ zoneCollapsed: { ...s.zoneCollapsed, [zone]: !s.zoneCollapsed[zone] } })),
  setUnits: (u) => set({ units: u }),
}))
