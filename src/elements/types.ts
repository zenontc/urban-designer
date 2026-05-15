export type DrawMode = 'line' | 'polygon' | 'place' | 'circle' | 'rect' | 'builder'

export interface ElementStyle {
  strokeColor: string
  strokeWidth: number
  strokeOpacity: number
  fillColor: string
  fillOpacity: number
  lineType: 'solid' | 'dashed' | 'dotted' | 'double' | 'custom'
  dashLength: number
  gapLength: number
  dashArray: number[]
  lineCap: 'butt' | 'round' | 'square'
  lineJoin: 'miter' | 'round' | 'bevel'
  arrowStart: 'none' | 'open' | 'filled' | 'tick'
  arrowEnd: 'none' | 'open' | 'filled' | 'tick'
  opacity: number
  fontSize: number
  fontWeight: 400 | 600 | 700
  fontStyle: 'normal' | 'italic'
  fontFamily: string
  extrudeHeight?: number
}

export interface StreetLane {
  id: string
  label: string
  width: number
  color: string
}

export interface StreetData {
  rowWidth: number
  surface: 'asphalt' | 'concrete' | 'pavers'
  lanes: StreetLane[]
}

export interface BuildingData {
  floors: number
  floorHeight: number
  totalHeight?: number
  groundFloorUse: string
  roofType: 'flat' | 'pitched' | 'green'
}

export interface TreeData {
  species: string
  canopyDiameter: number
  condition: 'good' | 'fair' | 'poor'
}

export interface LandUseData {
  designation: string
  far?: number
  opacityOverride?: number
}

export interface LightData {
  illuminationRadius: number
  colorTemp: number
}

export interface UMPFeatureProperties {
  id: string
  elementType: string
  category: string
  label: string
  phase: 'existing' | 'phase-1' | 'phase-2' | 'phase-3'
  status: 'existing' | 'proposed'
  layerGroup: string
  zIndex: number
  visible: boolean
  locked: boolean
  inMetrics: boolean
  style: ElementStyle
  streetData?: StreetData
  buildingData?: BuildingData
  treeData?: TreeData
  landUseData?: LandUseData
  lightData?: LightData
  streetLanes?: Array<{ id: string; label: string; width: number; color: string; icon: string }>
  textContent?: string
  fontSize?: number
  fontFamily?: string
  bezierNodes?: Array<{
    anchor: [number, number]
    handleIn: [number, number] | null
    handleOut: [number, number] | null
  }>
  createdAt: string
  updatedAt: string
}

export interface ElementTypeDefinition {
  id: string
  label: string
  category: string
  drawMode: DrawMode
  defaultStyle: Partial<ElementStyle>
  defaultProps: Record<string, unknown>
  minZoom?: number
  nightModeEmitter?: boolean
  illuminationRadius?: number
  icon?: string
  color?: string
}

export interface ElementCategory {
  id: string
  label: string
  icon: string
  color: string
  elements: ElementTypeDefinition[]
}
