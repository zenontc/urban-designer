import React, { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import { useMapStore } from '../store/mapStore'
import { useUIStore } from '../store/uiStore'
import { useCanvasStore, makeFeature } from '../store/canvasStore'
import type { UMPFeature } from '../store/canvasStore'
import type { UMPFeatureProperties } from '../elements/types'
import { useLayersStore } from '../store/layersStore'
import type { LayerItem } from '../store/layersStore'
import { MapOrientationControl } from './components/MapOrientationControl'
import { ELEMENT_CATEGORIES } from '../elements/categories'
import {
  lngLatToScreen, screenToLngLat, feetToPixels, haversineFt, fmtDist,
  distToSegment, pointInPolygon, screenBbox,
} from '../utils/geo'

const INITIAL_CENTER: [number, number] = [-87.6298, 41.8781]
const INITIAL_ZOOM = 15

const MAP_STYLES: Record<string, string> = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets:   'mapbox://styles/mapbox/streets-v12',
  light:     'mapbox://styles/mapbox/light-v11',
}

// ── Bezier pen types & helpers ───────────────────────────────────────────────

interface BezierNode {
  anchor: [number, number]
  handleIn: [number, number] | null   // incoming control point (lng/lat)
  handleOut: [number, number] | null  // outgoing control point (lng/lat)
}

function sampleCubicBezier(
  p0: [number, number], p1: [number, number],
  p2: [number, number], p3: [number, number],
  n = 24,
): [number, number][] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const b0 = (1 - t) ** 3, b1 = 3 * (1 - t) ** 2 * t
    const b2 = 3 * (1 - t) * t ** 2, b3 = t ** 3
    return [b0*p0[0]+b1*p1[0]+b2*p2[0]+b3*p3[0], b0*p0[1]+b1*p1[1]+b2*p2[1]+b3*p3[1]]
  })
}

function bezierNodesToCoords(nodes: BezierNode[]): [number, number][] {
  if (nodes.length < 2) return nodes.map(n => n.anchor)
  const coords: [number, number][] = [nodes[0].anchor]
  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1]
    const curr = nodes[i]
    const cp1 = prev.handleOut ?? prev.anchor
    const cp2 = curr.handleIn ?? curr.anchor
    const sampled = sampleCubicBezier(prev.anchor, cp1, cp2, curr.anchor, 24)
    coords.push(...sampled.slice(1))
  }
  return coords
}

function bezierNodesToSVGPath(map: mapboxgl.Map, nodes: BezierNode[], extraScreen?: [number, number], closed = false): string {
  if (nodes.length === 0) return ''
  const [fx, fy] = lngLatToScreen(map, nodes[0].anchor)
  let d = `M ${fx} ${fy}`
  for (let i = 1; i < nodes.length; i++) {
    const prev = nodes[i - 1]
    const curr = nodes[i]
    const [x2, y2] = lngLatToScreen(map, curr.anchor)
    const cp1 = prev.handleOut ? lngLatToScreen(map, prev.handleOut) : lngLatToScreen(map, prev.anchor)
    const cp2 = curr.handleIn ? lngLatToScreen(map, curr.handleIn) : [x2, y2]
    d += ` C ${cp1[0]} ${cp1[1]} ${cp2[0]} ${cp2[1]} ${x2} ${y2}`
  }
  if (closed && nodes.length >= 2) {
    const last = nodes[nodes.length - 1]
    const cp1 = last.handleOut ? lngLatToScreen(map, last.handleOut) : lngLatToScreen(map, last.anchor)
    const cp2 = nodes[0].handleIn ? lngLatToScreen(map, nodes[0].handleIn) : [fx, fy]
    d += ` C ${cp1[0]} ${cp1[1]} ${cp2[0]} ${cp2[1]} ${fx} ${fy} Z`
    return d
  }
  if (extraScreen) {
    const last = nodes[nodes.length - 1]
    const [lx, ly] = lngLatToScreen(map, last.anchor)
    const lho = last.handleOut ? lngLatToScreen(map, last.handleOut) : [lx, ly]
    d += ` C ${lho[0]} ${lho[1]} ${extraScreen[0]} ${extraScreen[1]} ${extraScreen[0]} ${extraScreen[1]}`
  }
  return d
}

// ── Snap helper ──────────────────────────────────────────────────────────────

interface SnapResult { lngLat: [number, number]; screen: [number, number] }

function getSnapPoint(
  map: mapboxgl.Map,
  features: UMPFeature[],
  sx: number, sy: number,
  radius = 12,
): SnapResult | null {
  let best: { r: SnapResult; dist: number } | null = null
  for (const f of features) {
    const candidates: [number, number][] = getVertices(f.geometry).map(v => v.coord)
    // midpoints
    if (f.geometry.type === 'LineString') {
      const cs = f.geometry.coordinates as [number, number][]
      for (let i = 0; i < cs.length - 1; i++)
        candidates.push([(cs[i][0]+cs[i+1][0])/2, (cs[i][1]+cs[i+1][1])/2])
    } else if (f.geometry.type === 'Polygon') {
      const ring = (f.geometry.coordinates as [number, number][][])[0]
      for (let i = 0; i < ring.length - 1; i++)
        candidates.push([(ring[i][0]+ring[i+1][0])/2, (ring[i][1]+ring[i+1][1])/2])
    }
    for (const coord of candidates) {
      const [px, py] = lngLatToScreen(map, coord)
      const dist = Math.hypot(px - sx, py - sy)
      if (dist <= radius && (!best || dist < best.dist))
        best = { r: { lngLat: coord, screen: [px, py] }, dist }
    }
  }
  return best?.r ?? null
}

// ── Geometry helpers ────────────────────────────────────────────────────────

function geomToScreenPath(map: mapboxgl.Map, geom: GeoJSON.Geometry): string {
  if (geom.type === 'LineString') {
    return (geom.coordinates as number[][]).map((c, i) => {
      const [x, y] = lngLatToScreen(map, c as [number, number])
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
  }
  if (geom.type === 'Polygon') {
    return (geom.coordinates as number[][][]).map(ring =>
      ring.map((c, i) => {
        const [x, y] = lngLatToScreen(map, c as [number, number])
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      }).join(' ') + ' Z'
    ).join(' ')
  }
  return ''
}

interface Vertex { coord: [number, number]; path: number[] }

function getVertices(geom: GeoJSON.Geometry): Vertex[] {
  if (geom.type === 'Point')
    return [{ coord: geom.coordinates as [number, number], path: [] }]
  if (geom.type === 'LineString')
    return (geom.coordinates as number[][]).map((c, i) => ({ coord: c as [number, number], path: [i] }))
  if (geom.type === 'Polygon') {
    const ring = (geom.coordinates as number[][][])[0]
    return ring.slice(0, -1).map((c, i) => ({ coord: c as [number, number], path: [0, i] }))
  }
  return []
}

function updateCoordInGeom(geom: GeoJSON.Geometry, path: number[], coord: [number, number]): GeoJSON.Geometry {
  const g = JSON.parse(JSON.stringify(geom)) as GeoJSON.Geometry
  if (g.type === 'Point') { (g as GeoJSON.Point).coordinates = coord; return g }
  if (g.type === 'LineString') { (g as GeoJSON.LineString).coordinates[path[0]] = coord; return g }
  if (g.type === 'Polygon') {
    const ring = (g as GeoJSON.Polygon).coordinates[path[0]]
    ring[path[1]] = coord
    if (path[1] === 0) ring[ring.length - 1] = coord
    return g
  }
  return g
}

function scaleGeometry(
  map: mapboxgl.Map,
  geom: GeoJSON.Geometry,
  origin: [number, number],
  start: [number, number],
  current: [number, number],
): GeoJSON.Geometry {
  const dx0 = start[0] - origin[0], dy0 = start[1] - origin[1]
  const dx1 = current[0] - origin[0], dy1 = current[1] - origin[1]
  const sx = Math.abs(dx0) > 0.5 ? dx1 / dx0 : 1
  const sy = Math.abs(dy0) > 0.5 ? dy1 / dy0 : 1
  function sc(coord: [number, number]): [number, number] {
    const [px, py] = lngLatToScreen(map, coord)
    return screenToLngLat(map, origin[0] + (px - origin[0]) * sx, origin[1] + (py - origin[1]) * sy)
  }
  const g = JSON.parse(JSON.stringify(geom)) as GeoJSON.Geometry
  if (g.type === 'Point') g.coordinates = sc(g.coordinates as [number, number])
  else if (g.type === 'LineString') g.coordinates = (g.coordinates as [number, number][]).map(sc)
  else if (g.type === 'Polygon') g.coordinates = (g.coordinates as [number, number][][]).map(r => r.map(sc))
  return g
}

function scaleBezierNodes(
  map: mapboxgl.Map,
  nodes: BezierNode[],
  origin: [number, number],
  start: [number, number],
  current: [number, number],
): BezierNode[] {
  const dx0 = start[0] - origin[0], dy0 = start[1] - origin[1]
  const dx1 = current[0] - origin[0], dy1 = current[1] - origin[1]
  const sx = Math.abs(dx0) > 0.5 ? dx1 / dx0 : 1
  const sy = Math.abs(dy0) > 0.5 ? dy1 / dy0 : 1
  function sc(coord: [number, number]): [number, number] {
    const [px, py] = lngLatToScreen(map, coord)
    return screenToLngLat(map, origin[0] + (px - origin[0]) * sx, origin[1] + (py - origin[1]) * sy)
  }
  return nodes.map(n => ({
    anchor: sc(n.anchor),
    handleIn: n.handleIn ? sc(n.handleIn) : null,
    handleOut: n.handleOut ? sc(n.handleOut) : null,
  }))
}

function rotateGeometry(
  map: mapboxgl.Map,
  geom: GeoJSON.Geometry,
  center: [number, number],
  angle: number,
): GeoJSON.Geometry {
  const [cx, cy] = lngLatToScreen(map, center)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  function rotCoord(coord: [number, number]): [number, number] {
    const [sx, sy] = lngLatToScreen(map, coord)
    const rx = cos * (sx - cx) - sin * (sy - cy) + cx
    const ry = sin * (sx - cx) + cos * (sy - cy) + cy
    return screenToLngLat(map, rx, ry)
  }
  const g = JSON.parse(JSON.stringify(geom)) as GeoJSON.Geometry
  if (g.type === 'Point') {
    g.coordinates = rotCoord(g.coordinates as [number, number])
  } else if (g.type === 'LineString') {
    g.coordinates = (g.coordinates as number[][]).map(c => rotCoord(c as [number, number]))
  } else if (g.type === 'Polygon') {
    g.coordinates = (g.coordinates as number[][][]).map(ring =>
      ring.map(c => rotCoord(c as [number, number])))
  }
  return g
}

function angleSnap(from: [number, number], to: [number, number]): [number, number] {
  const dx = to[0] - from[0], dy = to[1] - from[1]
  const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
  const dist = Math.hypot(dx, dy)
  return [from[0] + dist * Math.cos(angle), from[1] + dist * Math.sin(angle)]
}

// Hit-test features at a screen position
function hitTestFeatures(
  map: mapboxgl.Map,
  features: UMPFeature[],
  sx: number,
  sy: number,
): UMPFeature | null {
  for (let i = features.length - 1; i >= 0; i--) {
    const f = features[i]
    const g = f.geometry
    if (g.type === 'Point') {
      const [px, py] = lngLatToScreen(map, g.coordinates as [number, number])
      if (Math.hypot(px - sx, py - sy) < 14) return f
    }
    if (g.type === 'LineString') {
      const coords = g.coordinates as number[][]
      for (let j = 0; j < coords.length - 1; j++) {
        const [x1, y1] = lngLatToScreen(map, coords[j] as [number, number])
        const [x2, y2] = lngLatToScreen(map, coords[j + 1] as [number, number])
        if (distToSegment(sx, sy, x1, y1, x2, y2) < 8) return f
      }
    }
    if (g.type === 'Polygon') {
      const ring = (g.coordinates as number[][][])[0]
      const screenRing = ring.map(c => lngLatToScreen(map, c as [number, number]))
      if (pointInPolygon([sx, sy], screenRing)) return f
    }
  }
  return null
}

function translateGeometry(map: mapboxgl.Map, geom: GeoJSON.Geometry, dx: number, dy: number): GeoJSON.Geometry {
  function tr(coord: [number, number]): [number, number] {
    const [px, py] = lngLatToScreen(map, coord)
    return screenToLngLat(map, px + dx, py + dy)
  }
  const g = JSON.parse(JSON.stringify(geom)) as GeoJSON.Geometry
  if (g.type === 'Point') g.coordinates = tr(g.coordinates as [number, number])
  else if (g.type === 'LineString') g.coordinates = (g.coordinates as [number,number][]).map(tr)
  else if (g.type === 'Polygon') g.coordinates = (g.coordinates as [number,number][][]).map(r => r.map(tr))
  return g
}

// ── Polyline helpers ────────────────────────────────────────────────────────

function samplePolyline(map: mapboxgl.Map, coords: [number, number][], spacingPx: number): [number, number][] {
  const pts: [number, number][] = []
  let accumulated = 0
  const screen = coords.map(c => lngLatToScreen(map, c))
  for (let i = 1; i < screen.length; i++) {
    const [x1, y1] = screen[i - 1], [x2, y2] = screen[i]
    const segLen = Math.hypot(x2 - x1, y2 - y1)
    let d = accumulated === 0 ? spacingPx / 2 : spacingPx - accumulated
    while (d <= segLen) {
      const t = d / segLen
      pts.push(screenToLngLat(map, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t))
      d += spacingPx
    }
    accumulated = segLen - (d - spacingPx)
    if (accumulated >= segLen) accumulated = accumulated - segLen
  }
  return pts
}

function splitLineAtPoint(
  coords: [number, number][],
  map: mapboxgl.Map,
  sx: number, sy: number,
  hitRadius = 12,
): { a: [number, number][]; b: [number, number][] } | null {
  let bestDist = Infinity, bestSeg = -1, bestT = 0
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = lngLatToScreen(map, coords[i])
    const [x2, y2] = lngLatToScreen(map, coords[i + 1])
    const dx = x2 - x1, dy = y2 - y1
    const len2 = dx * dx + dy * dy
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((sx - x1) * dx + (sy - y1) * dy) / len2))
    const px = x1 + t * dx, py = y1 + t * dy
    const dist = Math.hypot(sx - px, sy - py)
    if (dist < bestDist) { bestDist = dist; bestSeg = i; bestT = t }
  }
  if (bestDist > hitRadius || bestSeg < 0) return null
  const [x1, y1] = lngLatToScreen(map, coords[bestSeg])
  const [x2, y2] = lngLatToScreen(map, coords[bestSeg + 1])
  const splitPt = screenToLngLat(map, x1 + bestT * (x2 - x1), y1 + bestT * (y2 - y1))
  return {
    a: [...coords.slice(0, bestSeg + 1), splitPt],
    b: [splitPt, ...coords.slice(bestSeg + 1)],
  }
}

// ── Main component ──────────────────────────────────────────────────────────

export function Canvas() {
  const outerRef = useRef<HTMLDivElement>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const styleLoadedRef = useRef(false)

  // Map re-render trigger
  const [mapVersion, setMapVersion] = useState(0)
  const [mapError, setMapError] = useState<string | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [mapStyle, setMapStyle] = useState<keyof typeof MAP_STYLES>('satellite')

  // Drawing state
  const [drawNodes, setDrawNodes] = useState<[number, number][]>([])
  const [cursorPos, setCursorPos] = useState<[number, number] | null>(null)

  // Bezier pen state
  const [penNodes, setPenNodes] = useState<BezierNode[]>([])
  const [penDragAnchor, setPenDragAnchor] = useState<{
    anchor: [number, number]; screen: [number, number]
  } | null>(null)
  // ref mirrors state so stale-closure callbacks always see fresh value
  const penDragAnchorRef = useRef<{ anchor: [number, number]; screen: [number, number] } | null>(null)
  const penHandledRef = useRef(false)

  // Snap
  const [snapTarget, setSnapTarget] = useState<SnapResult | null>(null)
  const snapTargetRef = useRef<SnapResult | null>(null)

  // Select-tool manual pan tracking
  const panStartRef = useRef<[number, number] | null>(null)

  // Space key for temporary pan
  const [spaceHeld, setSpaceHeld] = useState(false)
  const spaceHeldRef = useRef(false)

  // Shift key for angle snap
  const shiftHeldRef = useRef(false)

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; featureId: string } | null>(null)

  // Drag to move selected object
  const [draggingMove, setDraggingMove] = useState<{
    featureId: string; startScreen: [number, number]
    originalGeom: GeoJSON.Geometry; originalBezierNodes?: BezierNode[]
  } | null>(null)
  const wasDraggingRef = useRef(false)

  // Selection / node editing
  const [draggingNode, setDraggingNode] = useState<{ featureId: string; path: number[] } | null>(null)
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null)
  const [hoveredVertIdx, setHoveredVertIdx] = useState<number | null>(null)

  // Marquee
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const mouseDownOnFeatureRef = useRef(false)

  // Measure
  const [measurePts, setMeasurePts] = useState<[number, number][]>([])
  const measurePtsRef = useRef<[number, number][]>([])

  // Bezier direct-editing
  const [activeBezierNode, setActiveBezierNode] = useState<{ featureId: string; idx: number } | null>(null)
  const [draggingBezierHandle, setDraggingBezierHandle] = useState<{
    featureId: string; nodeIdx: number; which: 'handleIn' | 'handleOut' | 'anchor'
  } | null>(null)

  // Text
  const [textPopup, setTextPopup] = useState<{ x: number; y: number; lngLat: [number, number] } | null>(null)
  const [textInput, setTextInput] = useState('')

  // Extrude
  const [extrudeHeight, setExtrudeHeight] = useState(0)

  // Rotation
  const [draggingRotation, setDraggingRotation] = useState<{
    featureId: string
    startAngle: number
    centerScreen: [number, number]
    centerLngLat: [number, number]
  } | null>(null)
  const [hoveredRotHandle, setHoveredRotHandle] = useState(false)
  const [hoveredScaleHandle, setHoveredScaleHandle] = useState(false)

  // Scale dragging (Illustrator-style corner handles)
  const [draggingScale, setDraggingScale] = useState<{
    featureId: string
    originScreen: [number, number]   // fixed (opposite) corner
    startScreen: [number, number]    // where drag started
    originalGeom: GeoJSON.Geometry
    originalBezierNodes?: BezierNode[]
  } | null>(null)

  // Node editing mode: double-click feature to enter, Escape/click-empty to exit
  const [nodeEditingId, setNodeEditingId] = useState<string | null>(null)
  const nodeEditingIdRef = useRef<string | null>(null)
  useEffect(() => { nodeEditingIdRef.current = nodeEditingId }, [nodeEditingId])

  const { setMapInstance, setZoom, setCenter, setRotation, setPitch } = useMapStore()
  const {
    activeTool, setActiveTool, activeStyle, activeElementType,
    nightMode, mode3D, showCanvasSearch, canvasSearchQuery,
    setCanvasSearchQuery, toggleCanvasSearch,
  } = useUIStore()
  const { features, selectedIds, addFeature, updateGeometry, updateFeature, deleteFeatures, setSelectedIds, bringToFront, sendToBack } = useCanvasStore()
  const { layers, groups, addLayer } = useLayersStore()

  function addFeatureWithLayer(feature: Parameters<typeof addFeature>[0]) {
    addFeature(feature)
    const defaultGroupId = groups[0]?.id ?? 'elements'
    const layerEntry: Omit<LayerItem, 'id'> = {
      elementId: feature.properties.id,
      label: feature.properties.label,
      phase: groups[0]?.label ?? 'Elements',
      visible: true,
      locked: false,
      inMetrics: true,
      groupId: defaultGroupId,
    }
    addLayer(layerEntry)
  }

  // Refs for use in callbacks (avoid stale closures)
  const activeToolRef = useRef(activeTool)
  const featuresRef = useRef(features)
  const selectedIdsRef = useRef(selectedIds)
  const activeStyleRef = useRef(activeStyle)
  const activeElementTypeRef = useRef(activeElementType)
  const drawNodesRef = useRef(drawNodes)
  const penNodesRef = useRef(penNodes)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { featuresRef.current = features }, [features])
  useEffect(() => { selectedIdsRef.current = selectedIds }, [selectedIds])
  useEffect(() => { activeStyleRef.current = activeStyle }, [activeStyle])
  useEffect(() => { activeElementTypeRef.current = activeElementType }, [activeElementType])
  useEffect(() => { drawNodesRef.current = drawNodes }, [drawNodes])
  useEffect(() => { penNodesRef.current = penNodes }, [penNodes])
  useEffect(() => { snapTargetRef.current = snapTarget }, [snapTarget])
  useEffect(() => { measurePtsRef.current = measurePts }, [measurePts])

  // Extrude sync
  useEffect(() => {
    if (activeTool === 'extrude' && selectedIds.length === 1) {
      const f = features.find(x => x.properties.id === selectedIds[0])
      setExtrudeHeight(f?.properties.style?.extrudeHeight ?? 0)
    }
  }, [activeTool, selectedIds, features])

  // ── Map initialization ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const token = (import.meta.env.VITE_MAPBOX_TOKEN ?? '').replace(/^﻿/, '').trim()
    if (!token) { setMapError('Missing VITE_MAPBOX_TOKEN in .env'); return }
    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES.satellite,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      antialias: true,
      fadeDuration: 0,
      preserveDrawingBuffer: true,
    })

    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left')

    map.on('load', () => {
      styleLoadedRef.current = true
      setMapInstance(map)
      setMapError(null)
      // Auto-fly to user's location
      navigator.geolocation?.getCurrentPosition(pos => {
        map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15, duration: 1200 })
      })
    })
    map.on('error', (e) => {
      const msg = e.error?.message ?? ''
      if (msg.includes('401') || msg.includes('token') || msg.includes('Unauthorized'))
        setMapError('Invalid Mapbox token. Check your .env file.')
    })
    map.on('style.load', () => { styleLoadedRef.current = true })
    map.on('move', () => {
      setMapVersion(v => v + 1)
      const c = map.getCenter()
      setCenter([c.lng, c.lat])
      setZoom(map.getZoom())
      setRotation(map.getBearing())
      setPitch(map.getPitch())
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; setMapInstance(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Map style switch ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleLoadedRef.current) return
    styleLoadedRef.current = false
    map.setStyle(MAP_STYLES[mapStyle])
  }, [mapStyle])

  // ── 3D buildings ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleLoadedRef.current) return
    if (mode3D) {
      map.easeTo({ pitch: 45, duration: 600 })
      if (!map.getLayer('3d-buildings'))
        map.addLayer({
          id: '3d-buildings', source: 'composite', 'source-layer': 'building',
          filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 14,
          paint: {
            'fill-extrusion-color': '#aaa',
            'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'height']],
            'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.6,
          },
        })
    } else {
      map.easeTo({ pitch: 0, duration: 600 })
      if (map.getLayer('3d-buildings')) map.removeLayer('3d-buildings')
    }
  }, [mode3D])

  // ── Pan/zoom control per tool ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const drawingTools = ['pen', 'line', 'rect', 'ellipse', 'polygon', 'text', 'measure']
    // pan tool: dragPan enabled and interaction div is pointer-events:none, Mapbox handles it
    // select/direct: dragPan enabled; manual pan tracking via panStartRef
    // drawing tools: dragPan disabled so map doesn't fight with drawing
    if (drawingTools.includes(activeTool)) {
      map.dragPan.disable()
    } else {
      map.dragPan.enable()
    }
  }, [activeTool])

  // Cancel drawing state on tool switch
  useEffect(() => {
    setDrawNodes([])
    setPenNodes([])
    setPenDragAnchor(null)
    setSnapTarget(null)
    setCursorPos(null)
    if (activeTool !== 'measure') setMeasurePts([])
    setTextPopup(null)
  }, [activeTool])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    function down(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (!e.metaKey && !e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 'v': setActiveTool('select'); break
          case 'p': setActiveTool('pen'); break
          case 'l': setActiveTool('line'); break
          case 'r': setActiveTool('rect'); break
          case 'e': setActiveTool('ellipse'); break
          case 'g': setActiveTool('polygon'); break
          case 't': setActiveTool('text'); break
          case 'x': setActiveTool('extrude'); break
          case 'm': setActiveTool('measure'); break
          case 'escape':
            setDrawNodes([])
            setPenNodes([])
            setPenDragAnchor(null)
            setCursorPos(null)
            setMeasurePts([])
            setActiveTool('select')
            setSelectedIds([])
            setNodeEditingId(null)
            break
          case 'arrowleft':
          case 'arrowright':
          case 'arrowup':
          case 'arrowdown': {
            const map = mapRef.current
            if (!map || !selectedIdsRef.current.length) break
            e.preventDefault()
            const ids = selectedIdsRef.current
            const feat = featuresRef.current.find(f => f.properties.id === ids[0])
            if (!feat) break
            const coords = getVertices(feat.geometry)
            if (!coords.length) break
            const avgLat = coords.reduce((s, v) => s + v.coord[1], 0) / coords.length
            const oneFtPx = feetToPixels(map, 1, avgLat)
            const dx = e.key === 'ArrowLeft' ? -oneFtPx : e.key === 'ArrowRight' ? oneFtPx : 0
            const dy = e.key === 'ArrowUp' ? -oneFtPx : e.key === 'ArrowDown' ? oneFtPx : 0
            function nudgeCoord(coord: [number, number]): [number, number] {
              const [px, py] = lngLatToScreen(map!, coord)
              return screenToLngLat(map!, px + dx, py + dy)
            }
            const g = JSON.parse(JSON.stringify(feat.geometry)) as GeoJSON.Geometry
            if (g.type === 'Point') g.coordinates = nudgeCoord(g.coordinates as [number, number])
            else if (g.type === 'LineString') g.coordinates = (g.coordinates as [number,number][]).map(nudgeCoord)
            else if (g.type === 'Polygon') g.coordinates = (g.coordinates as [number,number][][]).map(r => r.map(nudgeCoord))
            useCanvasStore.getState().updateGeometry(ids[0], g)
            break
          }
          case 'delete':
          case 'backspace':
            if (selectedIdsRef.current.length) deleteFeatures(selectedIdsRef.current)
            break
        }
      }
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'z':
            e.preventDefault()
            e.shiftKey ? useCanvasStore.getState().redo() : useCanvasStore.getState().undo()
            break
          case 'a':
            e.preventDefault()
            setSelectedIds(featuresRef.current.map(f => f.properties.id))
            break
          case 'f':
            e.preventDefault()
            toggleCanvasSearch()
            break
        }
      }
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Space key tracking (temporary pan) ───────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !e.repeat) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        e.preventDefault()
        spaceHeldRef.current = true
        setSpaceHeld(true)
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        spaceHeldRef.current = false
        setSpaceHeld(false)
        panStartRef.current = null
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [])

  // ── Canvas coordinates ────────────────────────────────────────────────────
  const getCanvasXY = useCallback((e: React.MouseEvent): [number, number] => {
    const rect = outerRef.current?.getBoundingClientRect()
    if (!rect) return [0, 0]
    return [e.clientX - rect.left, e.clientY - rect.top]
  }, [])

  // ── Mouse events ──────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    const map = mapRef.current
    if (!map) return
    const [sx, sy] = getCanvasXY(e)
    const tool = activeToolRef.current

    mouseDownOnFeatureRef.current = false

    // ── Space+drag: temporary pan regardless of tool ──
    if (spaceHeldRef.current) {
      panStartRef.current = [sx, sy]
      return
    }

    // ── Marquee tool: always start marquee selection ──
    if (tool === 'marquee') {
      setMarquee({ x1: sx, y1: sy, x2: sx, y2: sy })
      return
    }

    // ── Pen tool: record anchor for potential bezier drag ──
    if (tool === 'pen') {
      const snap = snapTargetRef.current
      const anchor = snap ? snap.lngLat : screenToLngLat(map, sx, sy)
      const val = { anchor, screen: [sx, sy] as [number, number] }
      setPenDragAnchor(val)
      penDragAnchorRef.current = val
      return
    }

    if (tool === 'select' || tool === 'direct') {
      const selId = selectedIdsRef.current[0]
      const inNodeEdit = nodeEditingIdRef.current === selId && selId != null

      // ── Node editing mode (double-clicked into) ──
      if (inNodeEdit && selId) {
        const selFeat = featuresRef.current.find(f => f.properties.id === selId)
        if (selFeat) {
          const bezNodes = selFeat.properties.bezierNodes as BezierNode[] | undefined
          if (bezNodes) {
            const abn = activeBezierNode?.featureId === selId ? activeBezierNode : null
            if (abn) {
              const node = bezNodes[abn.idx]
              if (node) {
                for (const which of ['handleIn', 'handleOut'] as ('handleIn' | 'handleOut')[]) {
                  const h = node[which]
                  if (h) {
                    const [hx, hy] = lngLatToScreen(map, h)
                    if (Math.hypot(hx - sx, hy - sy) < 8) {
                      setDraggingBezierHandle({ featureId: selId, nodeIdx: abn.idx, which })
                      mouseDownOnFeatureRef.current = true
                      return
                    }
                  }
                }
              }
            }
            for (let i = 0; i < bezNodes.length; i++) {
              const [ax, ay] = lngLatToScreen(map, bezNodes[i].anchor)
              if (Math.hypot(ax - sx, ay - sy) < 8) {
                setActiveBezierNode({ featureId: selId, idx: i })
                setDraggingBezierHandle({ featureId: selId, nodeIdx: i, which: 'anchor' })
                mouseDownOnFeatureRef.current = true
                return
              }
            }
          } else {
            const verts = getVertices(selFeat.geometry)
            for (const v of verts) {
              const [vx, vy] = lngLatToScreen(map, v.coord)
              if (Math.hypot(vx - sx, vy - sy) < 9) {
                setDraggingNode({ featureId: selId, path: v.path })
                mouseDownOnFeatureRef.current = true
                return
              }
            }
          }
        }
      }

      // ── Regular select mode: corner handles (scale near, rotate far) ──
      if (!inNodeEdit && selId) {
        const selFeat = featuresRef.current.find(f => f.properties.id === selId)
        if (selFeat && selFeat.geometry.type !== 'Point') {
          const verts = getVertices(selFeat.geometry)
          const sVerts = verts.map(v => lngLatToScreen(map, v.coord))
          const bb = screenBbox(sVerts)
          if (bb.w > 2 || bb.h > 2) {
            const corners: [number, number][] = [
              [bb.x - 6, bb.y - 6],
              [bb.x + bb.w + 6, bb.y - 6],
              [bb.x - 6, bb.y + bb.h + 6],
              [bb.x + bb.w + 6, bb.y + bb.h + 6],
            ]
            const opposites: [number, number][] = [
              [bb.x + bb.w + 6, bb.y + bb.h + 6], // TL → opposite BR
              [bb.x - 6, bb.y + bb.h + 6],          // TR → opposite BL
              [bb.x + bb.w + 6, bb.y - 6],          // BL → opposite TR
              [bb.x - 6, bb.y - 6],                  // BR → opposite TL
            ]
            const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2
            for (let i = 0; i < 4; i++) {
              const [cornX, cornY] = corners[i]
              const d = Math.hypot(cornX - sx, cornY - sy)
              if (d < 16) {
                if (d < 7) {
                  // On corner handle → scale
                  setDraggingScale({
                    featureId: selId,
                    originScreen: opposites[i],
                    startScreen: [sx, sy],
                    originalGeom: JSON.parse(JSON.stringify(selFeat.geometry)),
                    originalBezierNodes: selFeat.properties.bezierNodes
                      ? JSON.parse(JSON.stringify(selFeat.properties.bezierNodes))
                      : undefined,
                  })
                } else {
                  // Near corner but outside handle → rotate
                  const centerLngLat = screenToLngLat(map, cx, cy)
                  setDraggingRotation({
                    featureId: selId,
                    startAngle: Math.atan2(sy - cy, sx - cx),
                    centerScreen: [cx, cy],
                    centerLngLat,
                  })
                }
                mouseDownOnFeatureRef.current = true
                return
              }
            }
          }
        }
      }
      // Check feature hit
      const visible = featuresRef.current.filter(
        f => !layers.find(l => l.id === f.properties.layerGroup && !l.visible)
      )
      const hit = hitTestFeatures(map, visible, sx, sy)
      if (hit) {
        mouseDownOnFeatureRef.current = true
        // If clicking a selected feature (not in node edit), start move drag
        if (!inNodeEdit && selectedIdsRef.current.includes(hit.properties.id)) {
          setDraggingMove({
            featureId: hit.properties.id,
            startScreen: [sx, sy],
            originalGeom: JSON.parse(JSON.stringify(hit.geometry)),
            originalBezierNodes: hit.properties.bezierNodes
              ? JSON.parse(JSON.stringify(hit.properties.bezierNodes))
              : undefined,
          })
        }
        return
      }
      // Shift+drag → marquee selection; plain drag → manual pan via panStartRef
      if (e.shiftKey) {
        setMarquee({ x1: sx, y1: sy, x2: sx, y2: sy })
      } else {
        panStartRef.current = [sx, sy]
      }
    }
  }, [getCanvasXY, layers, activeBezierNode])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const map = mapRef.current
    if (!map) return
    const [sx, sy] = getCanvasXY(e)
    const lngLat = screenToLngLat(map, sx, sy)
    shiftHeldRef.current = e.shiftKey
    setCursorPos([sx, sy])

    // Manual pan when dragging empty space (select tool) or space held
    if (panStartRef.current && (spaceHeldRef.current || activeToolRef.current === 'select' || activeToolRef.current === 'direct')) {
      const [lx, ly] = panStartRef.current
      map.panBy([-(sx - lx), -(sy - ly)], { animate: false, duration: 0 })
      panStartRef.current = [sx, sy]
      return
    }

    // Move dragging (drag selected feature to move it)
    if (draggingMove) {
      const dx = sx - draggingMove.startScreen[0]
      const dy = sy - draggingMove.startScreen[1]
      const newGeom = translateGeometry(map, draggingMove.originalGeom, dx, dy)
      updateGeometry(draggingMove.featureId, newGeom)
      if (draggingMove.originalBezierNodes) {
        const movedNodes = draggingMove.originalBezierNodes.map((n: BezierNode) => {
          const [ax, ay] = lngLatToScreen(map, n.anchor)
          const newAnchor = screenToLngLat(map, ax + dx, ay + dy)
          const newIn = n.handleIn ? (() => { const [hx, hy] = lngLatToScreen(map, n.handleIn!); return screenToLngLat(map, hx + dx, hy + dy) })() : null
          const newOut = n.handleOut ? (() => { const [hx, hy] = lngLatToScreen(map, n.handleOut!); return screenToLngLat(map, hx + dx, hy + dy) })() : null
          return { anchor: newAnchor, handleIn: newIn, handleOut: newOut }
        })
        updateFeature(draggingMove.featureId, { bezierNodes: movedNodes as UMPFeatureProperties['bezierNodes'] })
      }
      return
    }

    // Scale dragging (corner handle)
    if (draggingScale) {
      const feat = featuresRef.current.find(f => f.properties.id === draggingScale.featureId)
      if (feat) {
        const newGeom = scaleGeometry(map, draggingScale.originalGeom, draggingScale.originScreen, draggingScale.startScreen, [sx, sy])
        updateGeometry(feat.properties.id, newGeom)
        if (draggingScale.originalBezierNodes) {
          const scaledNodes = scaleBezierNodes(map, draggingScale.originalBezierNodes, draggingScale.originScreen, draggingScale.startScreen, [sx, sy])
          updateFeature(feat.properties.id, { bezierNodes: scaledNodes as UMPFeatureProperties['bezierNodes'] })
        }
      }
      return
    }

    // Snap detection (drawing tools only)
    const drawingTools = ['pen', 'line', 'rect', 'ellipse', 'polygon']
    if (drawingTools.includes(activeToolRef.current) && !penDragAnchorRef.current) {
      const visible = featuresRef.current.filter(
        f => !layers.find(l => l.id === f.properties.layerGroup && !l.visible)
      )
      setSnapTarget(getSnapPoint(map, visible, sx, sy))
    } else if (activeToolRef.current !== 'pen') {
      setSnapTarget(null)
    }

    // Bezier handle dragging (direct tool)
    if (draggingBezierHandle) {
      const feat = featuresRef.current.find(f => f.properties.id === draggingBezierHandle.featureId)
      if (feat?.properties.bezierNodes) {
        const nodes = feat.properties.bezierNodes as BezierNode[]
        const updatedNodes = nodes.map((n, i) => {
          if (i !== draggingBezierHandle.nodeIdx) return n
          if (draggingBezierHandle.which === 'anchor') {
            const dx = lngLat[0] - n.anchor[0], dy = lngLat[1] - n.anchor[1]
            return {
              anchor: lngLat,
              handleIn: n.handleIn ? [n.handleIn[0] + dx, n.handleIn[1] + dy] as [number, number] : null,
              handleOut: n.handleOut ? [n.handleOut[0] + dx, n.handleOut[1] + dy] as [number, number] : null,
            }
          }
          if (draggingBezierHandle.which === 'handleOut') {
            const mirror: [number, number] = [2 * n.anchor[0] - lngLat[0], 2 * n.anchor[1] - lngLat[1]]
            return { ...n, handleOut: lngLat as [number, number], handleIn: n.handleIn ? mirror : null }
          }
          if (draggingBezierHandle.which === 'handleIn') {
            const mirror: [number, number] = [2 * n.anchor[0] - lngLat[0], 2 * n.anchor[1] - lngLat[1]]
            return { ...n, handleIn: lngLat as [number, number], handleOut: n.handleOut ? mirror : null }
          }
          return n
        })
        const newCoords = updatedNodes.map(n => n.anchor)
        const g = JSON.parse(JSON.stringify(feat.geometry)) as GeoJSON.Geometry
        if (g.type === 'LineString') (g as GeoJSON.LineString).coordinates = newCoords
        if (g.type === 'Polygon') (g as GeoJSON.Polygon).coordinates[0] = [...newCoords, newCoords[0]]
        updateGeometry(feat.properties.id, g)
        updateFeature(feat.properties.id, { bezierNodes: updatedNodes as UMPFeatureProperties['bezierNodes'] })
      }
      return
    }

    // Rotation dragging
    if (draggingRotation) {
      const currentAngle = Math.atan2(sy - draggingRotation.centerScreen[1], sx - draggingRotation.centerScreen[0])
      const delta = currentAngle - draggingRotation.startAngle
      const feat = featuresRef.current.find(f => f.properties.id === draggingRotation.featureId)
      if (feat) {
        updateGeometry(draggingRotation.featureId, rotateGeometry(map, feat.geometry, draggingRotation.centerLngLat, delta))
        setDraggingRotation(prev => prev ? { ...prev, startAngle: currentAngle } : null)
      }
      return
    }

    // Node dragging
    if (draggingNode) {
      const feat = featuresRef.current.find(f => f.properties.id === draggingNode.featureId)
      if (feat) updateGeometry(draggingNode.featureId, updateCoordInGeom(feat.geometry, draggingNode.path, lngLat))
      return
    }

    // Marquee
    if (marquee) {
      setMarquee(prev => prev ? { ...prev, x2: sx, y2: sy } : null)
      return
    }

    // Hover detection for cursor changes
    if (activeToolRef.current === 'select' || activeToolRef.current === 'direct') {
      // Check corner hover (scale/rotate zone) — only in non-node-editing mode
      const selId = selectedIdsRef.current[0]
      const inNodeEdit = nodeEditingIdRef.current === selId && selId != null
      if (selId && !inNodeEdit) {
        const selFeat = featuresRef.current.find(f => f.properties.id === selId)
        if (selFeat && selFeat.geometry.type !== 'Point') {
          const verts = getVertices(selFeat.geometry)
          const sVerts = verts.map(v => lngLatToScreen(map, v.coord))
          const bb = screenBbox(sVerts)
          if (bb.w > 2 || bb.h > 2) {
            const corners: [number, number][] = [
              [bb.x - 6, bb.y - 6], [bb.x + bb.w + 6, bb.y - 6],
              [bb.x - 6, bb.y + bb.h + 6], [bb.x + bb.w + 6, bb.y + bb.h + 6],
            ]
            const onHandle = corners.some(([cx, cy]) => Math.hypot(cx - sx, cy - sy) < 7)
            const nearCorner = corners.some(([cx, cy]) => Math.hypot(cx - sx, cy - sy) < 16)
            if (nearCorner) {
              setHoveredScaleHandle(onHandle)
              setHoveredRotHandle(!onHandle)
              setHoveredVertIdx(null)
              setHoveredFeatureId(null)
              return
            }
          }
        }
      }
      setHoveredRotHandle(false)
      setHoveredScaleHandle(false)

      // Check vertex hover
      if (selId) {
        const selFeat = featuresRef.current.find(f => f.properties.id === selId)
        if (selFeat) {
          const verts = getVertices(selFeat.geometry)
          const found = verts.findIndex(v => {
            const [vx, vy] = lngLatToScreen(map, v.coord)
            return Math.hypot(vx - sx, vy - sy) < 9
          })
          setHoveredVertIdx(found >= 0 ? found : null)
          if (found >= 0) { setHoveredFeatureId(null); return }
        }
      }
      setHoveredVertIdx(null)
      const visible = featuresRef.current.filter(
        f => !layers.find(l => l.id === f.properties.layerGroup && !l.visible)
      )
      const hit = hitTestFeatures(map, visible, sx, sy)
      setHoveredFeatureId(hit?.properties.id ?? null)
    }
  }, [getCanvasXY, draggingRotation, draggingNode, draggingScale, draggingBezierHandle, draggingMove, marquee, updateGeometry, updateFeature, layers])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const map = mapRef.current
    if (!map) return
    const [sx, sy] = getCanvasXY(e)

    // Clear select-tool pan
    panStartRef.current = null

    if (draggingMove) {
      wasDraggingRef.current = true
      setDraggingMove(null)
      return
    }

    if (draggingBezierHandle) {
      wasDraggingRef.current = true
      setDraggingBezierHandle(null)
      return
    }

    if (draggingScale) {
      wasDraggingRef.current = true
      setDraggingScale(null)
      return
    }

    if (draggingRotation) {
      wasDraggingRef.current = true
      setDraggingRotation(null)
      return
    }

    // ── Pen tool: finalize node on mouse up ──
    const pda = penDragAnchorRef.current
    if (pda) {
      const [ux, uy] = getCanvasXY(e)
      const dragDist = Math.hypot(ux - pda.screen[0], uy - pda.screen[1])
      const isCorner = dragDist < 5

      let newNode: BezierNode
      if (isCorner) {
        newNode = { anchor: pda.anchor, handleIn: null, handleOut: null }
      } else {
        const anchorS = lngLatToScreen(map, pda.anchor)
        const handleOut = screenToLngLat(map, ux, uy)
        const handleIn = screenToLngLat(map, 2 * anchorS[0] - ux, 2 * anchorS[1] - uy)
        newNode = { anchor: pda.anchor, handleIn, handleOut }
      }

      const prev = penNodesRef.current

      // Convert smooth → corner: click (no drag) on an existing node with handles
      if (isCorner) {
        for (let i = 0; i < prev.length; i++) {
          const [nx, ny] = lngLatToScreen(map, prev[i].anchor)
          if (Math.hypot(nx - pda.screen[0], ny - pda.screen[1]) < 12) {
            if (prev[i].handleIn || prev[i].handleOut) {
              setPenNodes(ns => ns.map((n, idx) =>
                idx === i ? { anchor: n.anchor, handleIn: null, handleOut: null } : n
              ))
              setPenDragAnchor(null)
              penDragAnchorRef.current = null
              penHandledRef.current = true
              return
            }
          }
        }
      }

      // Check close-to-first-node for polygon close
      if (prev.length >= 3) {
        const [fx, fy] = lngLatToScreen(map, prev[0].anchor)
        if (Math.hypot(fx - pda.screen[0], fy - pda.screen[1]) < 14) {
          finishBezierPolygon(prev)
          setPenDragAnchor(null)
          penDragAnchorRef.current = null
          penHandledRef.current = true
          return
        }
      }

      setPenNodes(p => [...p, newNode])
      setPenDragAnchor(null)
      penDragAnchorRef.current = null
      penHandledRef.current = true
      return
    }

    if (draggingNode) {
      setDraggingNode(null)
      return
    }

    if (marquee) {
      const mx1 = Math.min(marquee.x1, marquee.x2)
      const mx2 = Math.max(marquee.x1, marquee.x2)
      const my1 = Math.min(marquee.y1, marquee.y2)
      const my2 = Math.max(marquee.y1, marquee.y2)
      if (mx2 - mx1 > 4 || my2 - my1 > 4) {
        const selected = featuresRef.current.filter(f => {
          const verts = getVertices(f.geometry)
          return verts.some(v => {
            const [vx, vy] = lngLatToScreen(map, v.coord)
            return vx >= mx1 && vx <= mx2 && vy >= my1 && vy <= my2
          })
        })
        if (selected.length) setSelectedIds(selected.map(f => f.properties.id))
      }
      setMarquee(null)
      return
    }

    // Unused — suppress lint warning
    void sx; void sy
  }, [getCanvasXY, draggingRotation, draggingNode, draggingScale, draggingBezierHandle, draggingMove, marquee, setSelectedIds])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const map = mapRef.current
    if (!map) return
    if (marquee) return
    if (draggingNode) return
    if (wasDraggingRef.current) { wasDraggingRef.current = false; return }
    setContextMenu(null)

    const [sx, sy] = getCanvasXY(e)
    const tool = activeToolRef.current

    // Pen tool handled entirely in mouseDown/mouseUp
    if (tool === 'pen') {
      if (penHandledRef.current) { penHandledRef.current = false; return }
      return
    }

    // Use snapped position if available, otherwise raw cursor
    const snap = snapTargetRef.current
    const lngLat: [number, number] = snap ? snap.lngLat : screenToLngLat(map, sx, sy)

    if (tool === 'text') {
      setTextPopup({ x: sx, y: sy, lngLat })
      return
    }

    if (tool === 'measure') {
      setMeasurePts(prev => [...prev, lngLat])
      return
    }

    if (tool === 'select' || tool === 'direct') {
      const visible = featuresRef.current.filter(
        f => !layers.find(l => l.id === f.properties.layerGroup && !l.visible)
      )
      const hit = hitTestFeatures(map, visible, sx, sy)

      if (hit) {
        if (e.shiftKey) {
          const ids = selectedIdsRef.current
          setSelectedIds(ids.includes(hit.properties.id)
            ? ids.filter(id => id !== hit.properties.id)
            : [...ids, hit.properties.id])
        } else {
          if (hit.properties.id !== selectedIdsRef.current[0]) {
            setActiveBezierNode(null)
            setNodeEditingId(null)
          }
          setSelectedIds([hit.properties.id])
        }
        return
      }
      setActiveBezierNode(null)
      setNodeEditingId(null)

      // Click-to-place for 'place' drawMode elements
      const elType = activeElementTypeRef.current
      if (elType) {
        const el = ELEMENT_CATEGORIES.flatMap(c => c.elements).find(x => x.id === elType)
        if (el?.drawMode === 'place') {
          addFeatureWithLayer(makeFeature(
            { type: 'Point', coordinates: lngLat },
            el.id, el.category,
            { style: { ...activeStyleRef.current, ...el.defaultStyle }, label: el.label },
          ))
          return
        }
      }

      setSelectedIds([])
      return
    }

    if (tool === 'line') {
      const prev = drawNodesRef.current
      let pt = lngLat
      if (e.shiftKey && prev.length > 0) {
        const fromS = lngLatToScreen(map, prev[prev.length - 1])
        const toS = snap ? snap.screen : [sx, sy] as [number, number]
        pt = screenToLngLat(map, ...angleSnap(fromS, toS))
      }
      setDrawNodes(p => [...p, pt])
      return
    }

    if (tool === 'polygon') {
      const prev = drawNodesRef.current
      if (prev.length >= 3) {
        const [fx, fy] = lngLatToScreen(map, prev[0])
        if (Math.hypot(fx - sx, fy - sy) < 12) {
          finishPolygon(prev)
          return
        }
      }
      let pt = lngLat
      if (e.shiftKey && prev.length > 0) {
        const fromS = lngLatToScreen(map, prev[prev.length - 1])
        const toS = snap ? snap.screen : [sx, sy] as [number, number]
        pt = screenToLngLat(map, ...angleSnap(fromS, toS))
      }
      setDrawNodes(p => [...p, pt])
      return
    }

    if (tool === 'rect') {
      if (drawNodesRef.current.length === 0) {
        setDrawNodes([lngLat])
      } else {
        finishRect(drawNodesRef.current[0], lngLat)
      }
      return
    }

    if (tool === 'ellipse') {
      if (drawNodesRef.current.length === 0) {
        setDrawNodes([lngLat])
      } else {
        finishEllipse(drawNodesRef.current[0], lngLat)
      }
      return
    }

    if (tool === 'addNode') {
      const selId = selectedIdsRef.current[0]
      if (!selId) return
      const feat = featuresRef.current.find(f => f.properties.id === selId)
      if (!feat) return
      if (feat.geometry.type === 'LineString') {
        const coords = (feat.geometry as GeoJSON.LineString).coordinates as [number, number][]
        let bestSeg = -1, bestT = 0, bestDist = Infinity
        for (let i = 0; i < coords.length - 1; i++) {
          const [x1, y1] = lngLatToScreen(map, coords[i])
          const [x2, y2] = lngLatToScreen(map, coords[i + 1])
          const dx = x2 - x1, dy = y2 - y1, len2 = dx*dx + dy*dy
          const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((sx-x1)*dx+(sy-y1)*dy)/len2))
          const dist = Math.hypot(sx - (x1+t*dx), sy - (y1+t*dy))
          if (dist < bestDist) { bestDist = dist; bestSeg = i; bestT = t }
        }
        if (bestSeg >= 0 && bestDist < 20) {
          const [x1, y1] = lngLatToScreen(map, coords[bestSeg])
          const [x2, y2] = lngLatToScreen(map, coords[bestSeg + 1])
          const newPt = screenToLngLat(map, x1 + bestT*(x2-x1), y1 + bestT*(y2-y1))
          const newCoords = [...coords.slice(0, bestSeg+1), newPt, ...coords.slice(bestSeg+1)]
          const g = { ...feat.geometry, coordinates: newCoords } as GeoJSON.Geometry
          updateGeometry(selId, g)
        }
      } else if (feat.geometry.type === 'Polygon') {
        const ring = ((feat.geometry as GeoJSON.Polygon).coordinates as [number,number][][])[0]
        let bestSeg = -1, bestT = 0, bestDist = Infinity
        for (let i = 0; i < ring.length - 1; i++) {
          const [x1, y1] = lngLatToScreen(map, ring[i])
          const [x2, y2] = lngLatToScreen(map, ring[i + 1])
          const dx = x2-x1, dy = y2-y1, len2 = dx*dx+dy*dy
          const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((sx-x1)*dx+(sy-y1)*dy)/len2))
          const dist = Math.hypot(sx-(x1+t*dx), sy-(y1+t*dy))
          if (dist < bestDist) { bestDist = dist; bestSeg = i; bestT = t }
        }
        if (bestSeg >= 0 && bestDist < 20) {
          const [x1, y1] = lngLatToScreen(map, ring[bestSeg])
          const [x2, y2] = lngLatToScreen(map, ring[bestSeg + 1])
          const newPt = screenToLngLat(map, x1+bestT*(x2-x1), y1+bestT*(y2-y1))
          const newRing = [...ring.slice(0, bestSeg+1), newPt, ...ring.slice(bestSeg+1)]
          const g = { ...feat.geometry, coordinates: [newRing] } as GeoJSON.Geometry
          updateGeometry(selId, g)
        }
      }
      return
    }

    if (tool === 'delNode') {
      const selId = selectedIdsRef.current[0]
      if (!selId) return
      const feat = featuresRef.current.find(f => f.properties.id === selId)
      if (!feat) return
      const verts = getVertices(feat.geometry)
      const hit = verts.findIndex(v => {
        const [vx, vy] = lngLatToScreen(map, v.coord)
        return Math.hypot(vx - sx, vy - sy) < 10
      })
      if (hit < 0) return
      if (feat.geometry.type === 'LineString') {
        const coords = (feat.geometry as GeoJSON.LineString).coordinates as [number,number][]
        if (coords.length <= 2) return
        const newCoords = coords.filter((_, i) => i !== hit)
        updateGeometry(selId, { ...feat.geometry, coordinates: newCoords } as GeoJSON.Geometry)
      } else if (feat.geometry.type === 'Polygon') {
        const ring = ((feat.geometry as GeoJSON.Polygon).coordinates as [number,number][][])[0]
        if (ring.length <= 4) return // min 3 vertices + closing point
        const newRing = ring.slice(0, -1).filter((_, i) => i !== hit)
        updateGeometry(selId, { ...feat.geometry, coordinates: [[...newRing, newRing[0]]] } as GeoJSON.Geometry)
      }
      return
    }

    if (tool === 'scissors') {
      const selId = selectedIdsRef.current[0]
      if (!selId) return
      const feat = featuresRef.current.find(f => f.properties.id === selId)
      if (!feat || feat.geometry.type !== 'LineString') return
      const coords = (feat.geometry as GeoJSON.LineString).coordinates as [number,number][]
      const split = splitLineAtPoint(coords, map, sx, sy, 16)
      if (!split) return
      if (split.a.length < 2 || split.b.length < 2) return
      const featA: UMPFeature = { ...feat, id: 'f_'+Math.random().toString(36).slice(2,10), properties: { ...feat.properties, id: 'f_'+Math.random().toString(36).slice(2,10) } }
      featA.geometry = { type: 'LineString', coordinates: split.a }
      const featB: UMPFeature = { ...feat, id: 'f_'+Math.random().toString(36).slice(2,10), properties: { ...feat.properties, id: 'f_'+Math.random().toString(36).slice(2,10) } }
      featB.geometry = { type: 'LineString', coordinates: split.b }
      deleteFeatures([selId])
      addFeatureWithLayer(featA)
      addFeatureWithLayer(featB)
      setSelectedIds([featA.properties.id])
      return
    }
  }, [getCanvasXY, marquee, draggingNode, addFeature, setSelectedIds, layers, updateGeometry, deleteFeatures])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const map = mapRef.current
    const tool = activeToolRef.current
    const nodes = drawNodesRef.current
    const pnodes = penNodesRef.current
    if (tool === 'line' && nodes.length >= 2) { finishLine(nodes); return }
    if (tool === 'polygon' && nodes.length >= 3) { finishPolygon(nodes); return }
    if (tool === 'pen') {
      if (pnodes.length >= 3) { finishBezierPolygon(pnodes); return }
      if (pnodes.length >= 2) { finishBezierLine(pnodes); return }
    }
    if (tool === 'measure') {
      const pts = measurePtsRef.current
      // Remove the last duplicate point added by the second click of the double-click
      const trimmed = pts.length > 1 ? pts.slice(0, -1) : pts
      if (trimmed.length >= 2) {
        const dist = trimmed.reduce((acc, p, i) => i === 0 ? 0 : acc + haversineFt(trimmed[i - 1], p), 0)
        addFeatureWithLayer(makeFeature(
          { type: 'LineString', coordinates: trimmed },
          'measurement', 'annotations',
          { label: `Measurement (${fmtDist(dist)})`, style: { ...activeStyleRef.current, strokeColor: '#F59E0B', strokeWidth: 2, dashArray: [5, 3], fillOpacity: 0 } },
        ))
        setMeasurePts([])
      }
      return
    }
    // Double-click on selected feature → enter node editing
    if ((tool === 'select' || tool === 'direct') && map) {
      const [sx, sy] = getCanvasXY(e)
      const selId = selectedIdsRef.current[0]
      if (selId) {
        const selFeat = featuresRef.current.find(f => f.properties.id === selId)
        if (selFeat) {
          const hit = hitTestFeatures(map, [selFeat], sx, sy)
          if (hit) { setNodeEditingId(selId); return }
        }
      }
      // Double-click on any feature selects + enters node editing
      const visible = featuresRef.current.filter(f => !layers.find(l => l.id === f.properties.layerGroup && !l.visible))
      const hit = hitTestFeatures(map, visible, sx, sy)
      if (hit) {
        setSelectedIds([hit.properties.id])
        setNodeEditingId(hit.properties.id)
      }
    }
  }, [getCanvasXY, layers, setSelectedIds])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const map = mapRef.current
    if (!map) return
    const [sx, sy] = getCanvasXY(e)
    const visible = featuresRef.current.filter(f => !layers.find(l => l.id === f.properties.layerGroup && !l.visible))
    const hit = hitTestFeatures(map, visible, sx, sy)
    if (hit) {
      setSelectedIds([hit.properties.id])
      setContextMenu({ x: sx, y: sy, featureId: hit.properties.id })
    }
  }, [getCanvasXY, layers, setSelectedIds])

  // ── Finish drawing ────────────────────────────────────────────────────────
  function makeElFeature(geom: GeoJSON.Geometry, fallbackType: string, fallbackCat: string) {
    const elType = activeElementTypeRef.current ?? fallbackType
    const el = ELEMENT_CATEGORIES.flatMap(c => c.elements).find(x => x.id === elType)
    return makeFeature(geom, elType, el?.category ?? fallbackCat, {
      style: { ...activeStyleRef.current, ...(el?.defaultStyle ?? {}) },
      label: el?.label ?? fallbackType,
    })
  }

  function finishLine(nodes: [number, number][]) {
    if (nodes.length < 2) return
    addFeatureWithLayer(makeElFeature({ type: 'LineString', coordinates: nodes }, 'line', 'custom'))
    setDrawNodes([])
  }

  function finishPolygon(nodes: [number, number][]) {
    if (nodes.length < 3) return
    addFeatureWithLayer(makeElFeature({ type: 'Polygon', coordinates: [[...nodes, nodes[0]]] }, 'polygon', 'custom'))
    setDrawNodes([])
  }

  function finishRect(p1: [number, number], p2: [number, number]) {
    const coords: [number, number][] = [p1, [p2[0], p1[1]], p2, [p1[0], p2[1]], p1]
    addFeatureWithLayer(makeElFeature({ type: 'Polygon', coordinates: [coords] }, 'rect', 'custom'))
    setDrawNodes([])
  }

  function finishEllipse(center: [number, number], edge: [number, number]) {
    const map = mapRef.current
    if (!map) return
    const [cx, cy] = lngLatToScreen(map, center)
    const [ex, ey] = lngLatToScreen(map, edge)
    const rx = Math.abs(ex - cx), ry = Math.abs(ey - cy)
    const pts: [number, number][] = Array.from({ length: 65 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2
      return screenToLngLat(map, cx + rx * Math.cos(a), cy + ry * Math.sin(a))
    })
    addFeatureWithLayer(makeElFeature({ type: 'Polygon', coordinates: [pts] }, 'ellipse', 'custom'))
    setDrawNodes([])
  }

  function finishBezierLine(nodes: BezierNode[]) {
    if (nodes.length < 2) return
    const coords = nodes.map(n => n.anchor)
    const feat = makeElFeature({ type: 'LineString', coordinates: coords }, 'pen', 'custom')
    feat.properties.bezierNodes = nodes
    addFeatureWithLayer(feat)
    setPenNodes([])
  }

  function finishBezierPolygon(nodes: BezierNode[]) {
    if (nodes.length < 3) return
    const coords: [number, number][] = [...nodes.map(n => n.anchor), nodes[0].anchor]
    const feat = makeElFeature({ type: 'Polygon', coordinates: [coords] }, 'pen', 'custom')
    feat.properties.bezierNodes = nodes
    addFeatureWithLayer(feat)
    setPenNodes([])
  }

  function duplicateSelected() {
    if (!contextMenu) return
    const feat = featuresRef.current.find(f => f.properties.id === contextMenu.featureId)
    if (!feat) return
    const newId = 'f_' + Math.random().toString(36).slice(2, 10)
    const now = new Date().toISOString()
    const dup: UMPFeature = { ...feat, id: newId, properties: { ...feat.properties, id: newId, createdAt: now, updatedAt: now } }
    addFeatureWithLayer(dup)
    setSelectedIds([newId])
    setContextMenu(null)
  }

  function applyExtrude(height: number) {
    if (!selectedIds[0]) return
    const f = features.find(x => x.properties.id === selectedIds[0])
    if (!f) return
    updateFeature(f.properties.id, { style: { ...f.properties.style, extrudeHeight: height } })
  }

  // ── Cursor ────────────────────────────────────────────────────────────────
  const CURSORS: Record<string, string> = {
    select: 'default', marquee: 'crosshair', direct: 'default', pen: 'crosshair', line: 'crosshair',
    rect: 'crosshair', ellipse: 'crosshair', polygon: 'crosshair',
    text: 'text', measure: 'crosshair', extrude: 'default',
    addNode: 'crosshair', delNode: 'crosshair', scissors: 'crosshair',
  }
  let cursor = CURSORS[activeTool] ?? 'default'
  if (spaceHeld) cursor = panStartRef.current ? 'grabbing' : 'grab'
  else if (draggingScale) cursor = 'nwse-resize'
  else if (draggingRotation) cursor = 'grabbing'
  else if (hoveredScaleHandle) cursor = 'nwse-resize'
  else if (hoveredRotHandle) cursor = 'grab'
  else if (draggingNode) cursor = 'crosshair'
  else if (hoveredVertIdx !== null) cursor = 'grab'
  else if (hoveredFeatureId && (activeTool === 'select' || activeTool === 'direct')) cursor = 'pointer'

  // ── SVG rendering ─────────────────────────────────────────────────────────

  function renderPointSymbol(
    f: UMPFeature, px: number, py: number,
    isSelected: boolean, isHovered: boolean,
    selColor: string, strokeColor: string,
  ) {
    const fill = f.properties.style.fillColor ?? '#2563EB'
    const sw = isSelected ? 2.5 : 1.5
    const cat = f.properties.category
    const elId = f.properties.elementType

    // Trees
    if (elId === 'tree' || elId === 'storm-tree-pit') {
      return (
        <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
          <circle cx={px} cy={py} r={10} fill={fill} fillOpacity={0.75} stroke={strokeColor} strokeWidth={sw} />
          <circle cx={px - 2} cy={py - 2} r={4} fill={fill} fillOpacity={0.5} />
          {isSelected && <circle cx={px} cy={py} r={14} fill="none" stroke={selColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />}
        </g>
      )
    }

    // Shrubs
    if (elId === 'shrub') {
      return (
        <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
          <circle cx={px} cy={py} r={6} fill={fill} fillOpacity={0.8} stroke={strokeColor} strokeWidth={sw} />
          {isSelected && <circle cx={px} cy={py} r={10} fill="none" stroke={selColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />}
        </g>
      )
    }

    // Actors (pedestrian, bicyclist, etc.)
    if (cat === 'actors') {
      const isVehicle = elId === 'car' || elId === 'delivery-vehicle' || elId === 'bus-vehicle'
      if (isVehicle) {
        const w = elId === 'bus-vehicle' ? 14 : 10
        const h = elId === 'bus-vehicle' ? 22 : 16
        return (
          <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
            <rect x={px - w / 2} y={py - h / 2} width={w} height={h} rx={2}
              fill={fill} stroke={strokeColor} strokeWidth={sw} />
            {isSelected && <circle cx={px} cy={py} r={Math.max(w, h) / 2 + 5}
              fill="none" stroke={selColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />}
          </g>
        )
      }
      // Person silhouette
      return (
        <g key={f.properties.id} style={{ pointerEvents: 'none' }} transform={`translate(${px},${py})`}>
          <circle cx={0} cy={-7} r={3.5} fill={fill} stroke={strokeColor} strokeWidth={sw * 0.7} />
          <path d="M0,-3 L0,4 M-4,0 L4,0 M0,4 L-3,11 M0,4 L3,11"
            stroke={fill} strokeWidth={2} strokeLinecap="round" fill="none" />
          {isSelected && <circle cx={0} cy={2} r={13} fill="none" stroke={selColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />}
        </g>
      )
    }

    // Furniture: bollard
    if (elId === 'bollard') {
      return (
        <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
          <rect x={px - 3} y={py - 7} width={6} height={14} rx={3}
            fill={fill} stroke={strokeColor} strokeWidth={sw} />
          {isSelected && <circle cx={px} cy={py} r={11} fill="none" stroke={selColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />}
        </g>
      )
    }

    // Furniture: street light / ped light
    if (elId === 'street-light' || elId === 'ped-light') {
      return (
        <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
          <line x1={px} y1={py + 8} x2={px} y2={py - 8} stroke={fill} strokeWidth={2} strokeLinecap="round" />
          <line x1={px} y1={py - 8} x2={px + 6} y2={py - 8} stroke={fill} strokeWidth={2} strokeLinecap="round" />
          <circle cx={px + 6} cy={py - 8} r={3} fill="#FCD34D" stroke={fill} strokeWidth={1} />
          {isSelected && <circle cx={px} cy={py} r={13} fill="none" stroke={selColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />}
        </g>
      )
    }

    // Transit stations
    if (cat === 'transit' && elId !== 'bus-stop') {
      return (
        <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
          <rect x={px - 9} y={py - 9} width={18} height={18} rx={3}
            fill={fill} stroke={strokeColor} strokeWidth={sw} />
          <text x={px} y={py + 1} textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize={9} fontWeight="bold" style={{ userSelect: 'none' }}>
            {elId === 'rail-station' ? 'R' : elId === 'brt-station' ? 'B' : elId === 'ferry-terminal' ? 'F' : 'T'}
          </text>
          {isSelected && <rect x={px - 13} y={py - 13} width={26} height={26} rx={5}
            fill="none" stroke={selColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />}
        </g>
      )
    }

    // Default: colored circle
    return (
      <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
        <circle cx={px} cy={py} r={8} fill={fill} stroke={strokeColor} strokeWidth={sw} />
        {isSelected && <circle cx={px} cy={py} r={12} fill="none" stroke={selColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />}
      </g>
    )
  }

  const map = mapRef.current
  const visibleFeatures = map
    ? features.filter(f => !layers.find(l => l.id === f.properties.layerGroup && !l.visible))
    : []

  function renderFeatures() {
    if (!map) return null
    return visibleFeatures.map(f => {
      const style = f.properties.style
      const isSelected = selectedIds.includes(f.properties.id)
      const isHovered = hoveredFeatureId === f.properties.id
      const selColor = '#F59E0B'
      const strokeColor = isSelected ? selColor : isHovered ? '#60A5FA' : (style.strokeColor ?? '#2563EB')
      const dash = style.lineType === 'dashed' ? '8 5' : style.lineType === 'dotted' ? '2 4' : undefined

      if (f.geometry.type === 'Point') {
        const [px, py] = lngLatToScreen(map, f.geometry.coordinates as [number, number])
        const isText = f.properties.elementType === 'text'
        if (isText) {
          const ts = f.properties.style as typeof style & { textContent?: string }
          return (
            <text key={f.properties.id} x={px} y={py} textAnchor="middle" dominantBaseline="middle"
              fill={strokeColor} fontSize={style.fontSize ?? 16} fontFamily={style.fontFamily ?? 'Inter'}
              style={{ pointerEvents: 'none', userSelect: 'none' }}>
              {ts.textContent ?? f.properties.label}
            </text>
          )
        }
        return renderPointSymbol(f, px, py, isSelected, isHovered, selColor, strokeColor)
      }

      const bezNodes = f.properties.bezierNodes as BezierNode[] | undefined
      const path = bezNodes
        ? bezierNodesToSVGPath(map, bezNodes, undefined, f.geometry.type === 'Polygon')
        : geomToScreenPath(map, f.geometry)
      const isLine = f.geometry.type === 'LineString'
      const sw = style.strokeWidth ?? 2

      // ── Measurement features: amber dashed line + segment labels ──
      if (f.properties.elementType === 'measurement' && isLine) {
        const coords = (f.geometry as GeoJSON.LineString).coordinates as [number, number][]
        return (
          <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
            <path d={path} fill="none" stroke="#F59E0B" strokeWidth={2} strokeDasharray="6 4" />
            {coords.slice(1).map((pt, i) => {
              const from = coords[i]
              const d = haversineFt(from, pt)
              const mid: [number, number] = [(from[0] + pt[0]) / 2, (from[1] + pt[1]) / 2]
              const [mx, my] = lngLatToScreen(map, mid)
              return (
                <text key={i} x={mx} y={my} textAnchor="middle" dominantBaseline="middle"
                  fontSize={11} fontWeight="600" fontFamily="Inter"
                  fill="#F59E0B" stroke="rgba(0,0,0,0.75)" strokeWidth={3} paintOrder="stroke"
                  style={{ userSelect: 'none' }}>
                  {fmtDist(d)}
                </text>
              )
            })}
          </g>
        )
      }

      // ── Crosswalk rendering ──
      if ((f.properties.elementType === 'std-crosswalk' || f.properties.elementType === 'continental-crosswalk' || f.properties.elementType === 'raised-crosswalk') && isLine) {
        const coords = (f.geometry as GeoJSON.LineString).coordinates as [number, number][]
        if (coords.length >= 2) {
          const [x1, y1] = lngLatToScreen(map, coords[0])
          const [x2, y2] = lngLatToScreen(map, coords[coords.length - 1])
          const len = Math.hypot(x2 - x1, y2 - y1)
          const ang = Math.atan2(y2 - y1, x2 - x1)
          const widthPx = feetToPixels(map, 6, coords[0][1])
          const stripeW = f.properties.elementType === 'continental-crosswalk' ? 14 : 10
          const gapW = f.properties.elementType === 'continental-crosswalk' ? 6 : 10
          const stripes: React.ReactNode[] = []
          for (let d = 0; d < len; d += stripeW + gapW) {
            const w = Math.min(stripeW, len - d)
            stripes.push(<rect key={d} x={x1 + d * Math.cos(ang)} y={y1 + d * Math.sin(ang) - widthPx / 2} width={w} height={widthPx} fill="white" opacity={0.9} transform={`rotate(${ang * 180 / Math.PI},${x1 + d * Math.cos(ang)},${y1 + d * Math.sin(ang)})`} />)
          }
          return (
            <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
              <rect x={x1} y={y1 - widthPx / 2} width={len} height={widthPx} fill="#555" transform={`rotate(${ang * 180 / Math.PI},${x1},${y1})`} />
              {stripes}
              {isSelected && <path d={path} fill="none" stroke={selColor} strokeWidth={widthPx + 6} strokeOpacity={0.35} />}
            </g>
          )
        }
      }

      // ── Street tree row rendering ──
      if (f.properties.elementType === 'street-tree' && isLine) {
        const coords = (f.geometry as GeoJSON.LineString).coordinates as [number, number][]
        const spacingPx = feetToPixels(map, 25, coords[0][1])
        const samples = samplePolyline(map, coords, spacingPx)
        const fill = style.fillColor ?? '#22C55E'
        return (
          <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
            <path d={path} fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth={1} strokeDasharray="4 4" />
            {samples.map((pt, i) => {
              const [px, py] = lngLatToScreen(map, pt)
              return (
                <g key={i}>
                  <circle cx={px} cy={py} r={10} fill={fill} fillOpacity={0.8} stroke="rgba(0,0,0,0.3)" strokeWidth={1} />
                  <circle cx={px - 3} cy={py - 3} r={4} fill={fill} fillOpacity={0.5} />
                </g>
              )
            })}
            {isSelected && <path d={path} fill="none" stroke={selColor} strokeWidth={3} strokeOpacity={0.5} />}
          </g>
        )
      }

      // ── String lights rendering ──
      if (f.properties.elementType === 'string-lights' && isLine) {
        const coords = (f.geometry as GeoJSON.LineString).coordinates as [number, number][]
        const spacingPx = feetToPixels(map, 6, coords[0][1])
        const samples = samplePolyline(map, coords, spacingPx)
        const lightColor = style.strokeColor ?? '#FCD34D'
        return (
          <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
            <path d={path} fill="none" stroke="rgba(100,80,20,0.5)" strokeWidth={1} />
            {samples.map((pt, i) => {
              const [px, py] = lngLatToScreen(map, pt)
              return (
                <g key={i}>
                  <circle cx={px} cy={py} r={5} fill={lightColor} fillOpacity={0.25} />
                  <circle cx={px} cy={py} r={3} fill={lightColor} fillOpacity={0.6} />
                  <circle cx={px} cy={py} r={1.5} fill={lightColor} />
                </g>
              )
            })}
          </g>
        )
      }

      // ── Corridor rendering for street-section elements ──
      if (f.properties.category === 'streets' && isLine) {
        const el = ELEMENT_CATEGORIES.flatMap(c => c.elements).find(x => x.id === f.properties.elementType)
        const rowWidthFt = (el?.defaultProps as { rowWidth?: number })?.rowWidth ?? 30
        const coords = (f.geometry as GeoJSON.LineString).coordinates as [number, number][]
        const avgLat = coords.reduce((s, c) => s + (c as [number,number])[1], 0) / coords.length
        const corrPx = Math.max(4, feetToPixels(map, rowWidthFt, avgLat))
        const roadColor = style.strokeColor ?? '#374151'
        return (
          <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
            {isSelected && <path d={path} fill="none" stroke={selColor} strokeWidth={corrPx + 6} strokeLinecap="butt" strokeLinejoin="round" strokeOpacity={0.35} />}
            {/* Curb edge */}
            <path d={path} fill="none" stroke="#111827" strokeWidth={corrPx} strokeLinecap="butt" strokeLinejoin="round" />
            {/* Road surface */}
            <path d={path} fill="none" stroke={roadColor} strokeWidth={corrPx - 3} strokeLinecap="butt" strokeLinejoin="round" />
            {/* Centerline */}
            <path d={path} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeLinecap="round" strokeDasharray="8 6" />
          </g>
        )
      }

      return (
        <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
          {!isLine && (
            <path d={path} fill={style.fillColor ?? '#2563EB'}
              fillOpacity={(style.fillOpacity ?? 70) / 100} fillRule="evenodd" />
          )}
          <path d={path} fill="none" stroke={strokeColor}
            strokeWidth={isSelected ? sw + 1.5 : sw}
            strokeLinecap={(['butt','round','square'].includes(style.lineCap ?? '') ? style.lineCap : 'round') as 'butt' | 'round' | 'square'}
            strokeLinejoin={(['miter','round','bevel'].includes(style.lineJoin ?? '') ? style.lineJoin : 'round') as 'miter' | 'round' | 'bevel'}
            strokeDasharray={dash} />
        </g>
      )
    })
  }

  function renderPlacePreview() {
    if (!map || !cursorPos) return null
    const elType = activeElementType
    if (!elType) return null
    const el = ELEMENT_CATEGORIES.flatMap(c => c.elements).find(x => x.id === elType)
    if (!el || el.drawMode !== 'place') return null
    const [px, py] = cursorPos
    const fill = el.defaultStyle?.fillColor ?? '#2563EB'
    const cat = el.category
    const id = el.id

    // Reuse same symbol logic with opacity wrapper
    const dummy = {
      properties: { id: '__preview__', elementType: id, category: cat, style: el.defaultStyle ?? {}, label: el.label },
      geometry: { type: 'Point' as const, coordinates: [0, 0] },
    } as UMPFeature

    return (
      <g style={{ pointerEvents: 'none', opacity: 0.6 }}>
        {renderPointSymbol(dummy, px, py, false, false, '#F59E0B', fill)}
      </g>
    )
  }

  function renderActiveDraw() {
    if (!map || !cursorPos) return null
    const [cx, cy] = cursorPos
    const tool = activeTool

    // ── Bezier pen preview ───────────────────────────────────────────────────
    if (tool === 'pen') {
      const nodes = penNodes
      const snap = snapTarget
      const targetScreen: [number, number] = snap ? snap.screen : [cx, cy]

      // Live bezier path
      const liveHandleIn: [number, number] | null = penDragAnchor
        ? [2 * lngLatToScreen(map, penDragAnchor.anchor)[0] - cx,
           2 * lngLatToScreen(map, penDragAnchor.anchor)[1] - cy]
        : null

      let pathD = ''
      if (nodes.length > 0) {
        pathD = bezierNodesToSVGPath(map, nodes)
        const last = nodes[nodes.length - 1]
        const [lx, ly] = lngLatToScreen(map, last.anchor)
        const lho = last.handleOut ? lngLatToScreen(map, last.handleOut) : [lx, ly]
        const inCP = liveHandleIn ?? targetScreen
        const anchorS = penDragAnchor ? lngLatToScreen(map, penDragAnchor.anchor) : targetScreen
        pathD += ` C ${lho[0]} ${lho[1]} ${inCP[0]} ${inCP[1]} ${anchorS[0]} ${anchorS[1]}`
      }

      return (
        <g style={{ pointerEvents: 'none' }}>
          {pathD && <path d={pathD} fill="none" stroke="#2563EB" strokeWidth={2} strokeDasharray="6 4" opacity={0.85} />}

          {/* Close-path hint ring */}
          {nodes.length >= 3 && (() => {
            const [fx, fy] = lngLatToScreen(map, nodes[0].anchor)
            const dist = Math.hypot(fx - targetScreen[0], fy - targetScreen[1])
            return dist < 20 ? <circle cx={fx} cy={fy} r={11} fill="none" stroke="#2563EB" strokeWidth={1.5} opacity={0.6} /> : null
          })()}

          {/* Confirmed anchor points */}
          {nodes.map((node, i) => {
            const [nx, ny] = lngLatToScreen(map, node.anchor)
            return (
              <g key={i}>
                {node.handleOut && (() => {
                  const [hx, hy] = lngLatToScreen(map, node.handleOut)
                  return <><line x1={nx} y1={ny} x2={hx} y2={hy} stroke="#2563EB" strokeWidth={1} opacity={0.5} /><circle cx={hx} cy={hy} r={3} fill="#2563EB" opacity={0.6} /></>
                })()}
                {node.handleIn && (() => {
                  const [hx, hy] = lngLatToScreen(map, node.handleIn)
                  return <><line x1={nx} y1={ny} x2={hx} y2={hy} stroke="#2563EB" strokeWidth={1} opacity={0.5} /><circle cx={hx} cy={hy} r={3} fill="#2563EB" opacity={0.6} /></>
                })()}
                <circle cx={nx} cy={ny} r={4} fill="white" stroke="#2563EB" strokeWidth={1.5} />
              </g>
            )
          })}

          {/* Current drag handles */}
          {penDragAnchor && (() => {
            const [ax, ay] = lngLatToScreen(map, penDragAnchor.anchor)
            const mirX = 2 * ax - cx, mirY = 2 * ay - cy
            return (
              <g>
                <line x1={ax} y1={ay} x2={cx} y2={cy} stroke="#2563EB" strokeWidth={1} opacity={0.7} />
                <circle cx={cx} cy={cy} r={3.5} fill="#2563EB" opacity={0.8} />
                <line x1={ax} y1={ay} x2={mirX} y2={mirY} stroke="#2563EB" strokeWidth={1} opacity={0.4} />
                <circle cx={mirX} cy={mirY} r={3.5} fill="#2563EB" opacity={0.4} />
                <circle cx={ax} cy={ay} r={4.5} fill="white" stroke="#2563EB" strokeWidth={1.5} />
              </g>
            )
          })()}

          {/* Snap indicator */}
          {snap && <circle cx={snap.screen[0]} cy={snap.screen[1]} r={10} fill="none" stroke="#F59E0B" strokeWidth={2} />}
        </g>
      )
    }

    // ── Polygon preview ──────────────────────────────────────────────────────
    if (tool === 'polygon' && drawNodes.length > 0) {
      const pts = drawNodes.map(n => lngLatToScreen(map, n))
      const rawS = snapTarget?.screen ?? [cx, cy] as [number, number]
      const snapS = shiftHeldRef.current ? angleSnap(pts[pts.length - 1] as [number, number], rawS) : rawS
      const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
      return (
        <g style={{ pointerEvents: 'none' }}>
          <path d={`${d} L ${snapS[0]} ${snapS[1]}`} fill="none" stroke="#2563EB" strokeWidth={2} strokeDasharray="6 4" opacity={0.85} />
          {drawNodes.length >= 3 && (
            <line x1={snapS[0]} y1={snapS[1]} x2={pts[0][0]} y2={pts[0][1]} stroke="#2563EB" strokeWidth={1} strokeDasharray="4 4" opacity={0.4} />
          )}
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4} fill="white" stroke="#2563EB" strokeWidth={1.5} />
          ))}
          {drawNodes.length >= 3 && (
            <circle cx={pts[0][0]} cy={pts[0][1]} r={9} fill="none" stroke="#2563EB" strokeWidth={1.5} opacity={0.55} />
          )}
          {snapTarget && <circle cx={snapTarget.screen[0]} cy={snapTarget.screen[1]} r={10} fill="none" stroke="#F59E0B" strokeWidth={2} />}
        </g>
      )
    }

    if (tool === 'line' && drawNodes.length > 0) {
      const pts = drawNodes.map(n => lngLatToScreen(map, n))
      const rawS = snapTarget?.screen ?? [cx, cy] as [number, number]
      const snapS = shiftHeldRef.current ? angleSnap(pts[pts.length - 1] as [number, number], rawS) : rawS
      const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
      return (
        <g style={{ pointerEvents: 'none' }}>
          <path d={`${d} L ${snapS[0]} ${snapS[1]}`} fill="none" stroke="#2563EB" strokeWidth={2} strokeDasharray="6 4" />
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4} fill="white" stroke="#2563EB" strokeWidth={1.5} />
          ))}
          {snapTarget && <circle cx={snapTarget.screen[0]} cy={snapTarget.screen[1]} r={10} fill="none" stroke="#F59E0B" strokeWidth={2} />}
        </g>
      )
    }

    if (tool === 'rect' && drawNodes.length === 1) {
      const [x1, y1] = lngLatToScreen(map, drawNodes[0])
      return (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={Math.min(x1, cx)} y={Math.min(y1, cy)} width={Math.abs(cx - x1)} height={Math.abs(cy - y1)}
            fill="rgba(37,99,235,0.08)" stroke="#2563EB" strokeWidth={1.5} strokeDasharray="5 3" />
        </g>
      )
    }

    if (tool === 'ellipse' && drawNodes.length === 1) {
      const [x1, y1] = lngLatToScreen(map, drawNodes[0])
      return (
        <g style={{ pointerEvents: 'none' }}>
          <ellipse cx={x1} cy={y1} rx={Math.abs(cx - x1)} ry={Math.abs(cy - y1)}
            fill="rgba(37,99,235,0.08)" stroke="#2563EB" strokeWidth={1.5} strokeDasharray="5 3" />
        </g>
      )
    }

    return null
  }

  function renderSelection() {
    if (!map || selectedIds.length === 0) return null
    return selectedIds.map(id => {
      const f = features.find(x => x.properties.id === id)
      if (!f) return null
      const verts = getVertices(f.geometry)
      if (verts.length === 0) return null
      const screenVerts = verts.map(v => lngLatToScreen(map, v.coord))

      const bb = screenBbox(screenVerts)
      const hasBbox = bb.w > 2 || bb.h > 2
      const bezNodes = f.properties.bezierNodes as BezierNode[] | undefined
      const inNodeEdit = nodeEditingId === id

      return (
        <g key={`sel-${id}`} style={{ pointerEvents: 'none' }}>
          {/* Bounding box (always) */}
          {hasBbox && (
            <rect x={bb.x - 6} y={bb.y - 6} width={bb.w + 12} height={bb.h + 12}
              fill="none" stroke="#2563EB" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
          )}

          {/* Regular select mode: 4 corner handles (scale within 7px, rotate 7–16px) */}
          {!inNodeEdit && hasBbox && f.geometry.type !== 'Point' && (
            <>
              {([
                [bb.x - 6, bb.y - 6], [bb.x + bb.w + 6, bb.y - 6],
                [bb.x - 6, bb.y + bb.h + 6], [bb.x + bb.w + 6, bb.y + bb.h + 6],
              ] as [number, number][]).map(([cx, cy], i) => (
                <rect key={i} x={cx - 4} y={cy - 4} width={8} height={8}
                  fill="white" stroke="#2563EB" strokeWidth={1.5} />
              ))}
            </>
          )}

          {/* Node editing mode: anchor handles + bezier handles for active node */}
          {inNodeEdit && (
            <>
              {bezNodes ? (
                bezNodes.map((node, i) => {
                  const [ax, ay] = lngLatToScreen(map, node.anchor)
                  const isActive = activeBezierNode?.featureId === id && activeBezierNode.idx === i
                  return (
                    <g key={i}>
                      {isActive && node.handleIn && (() => {
                        const [hx, hy] = lngLatToScreen(map, node.handleIn)
                        return <><line x1={ax} y1={ay} x2={hx} y2={hy} stroke="#2563EB" strokeWidth={1} opacity={0.5} /><circle cx={hx} cy={hy} r={4} fill="#2563EB" opacity={0.8} /></>
                      })()}
                      {isActive && node.handleOut && (() => {
                        const [hx, hy] = lngLatToScreen(map, node.handleOut)
                        return <><line x1={ax} y1={ay} x2={hx} y2={hy} stroke="#2563EB" strokeWidth={1} opacity={0.5} /><circle cx={hx} cy={hy} r={4} fill="#2563EB" opacity={0.8} /></>
                      })()}
                      {/* All nodes are squares; smooth nodes get a rounded corner hint */}
                      <rect x={ax - 4} y={ay - 4} width={8} height={8}
                        rx={(node.handleIn || node.handleOut) ? 2 : 0}
                        fill={isActive ? '#2563EB' : 'white'} stroke="#2563EB" strokeWidth={1.5} />
                    </g>
                  )
                })
              ) : (
                screenVerts.map(([vx, vy], i) => (
                  <rect key={i} x={vx - 4} y={vy - 4} width={8} height={8}
                    fill={hoveredVertIdx === i ? '#2563EB' : 'white'} stroke="#2563EB" strokeWidth={1.5} />
                ))
              )}
            </>
          )}
        </g>
      )
    })
  }

  function renderMeasure() {
    if (!map || activeTool !== 'measure') return null
    const pts = measurePts.map(p => lngLatToScreen(map, p))
    return (
      <g style={{ pointerEvents: 'none' }}>
        {pts.length > 1 && (
          <path d={pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')}
            fill="none" stroke="#F59E0B" strokeWidth={2} strokeDasharray="5 3" />
        )}
        {cursorPos && pts.length > 0 && (
          <line x1={pts[pts.length - 1][0]} y1={pts[pts.length - 1][1]}
            x2={cursorPos[0]} y2={cursorPos[1]}
            stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.6} />
        )}
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={5} fill="#F59E0B" stroke="white" strokeWidth={1.5} />
        ))}
      </g>
    )
  }

  // ── Measure labels ────────────────────────────────────────────────────────
  const measureDistances = map && measurePts.length > 1
    ? measurePts.slice(1).map((p, i) => {
        const d = haversineFt(measurePts[i], p)
        const mid: [number, number] = [(measurePts[i][0] + p[0]) / 2, (measurePts[i][1] + p[1]) / 2]
        return { d, screen: lngLatToScreen(map, mid) }
      })
    : []
  const totalDist = measurePts.reduce((acc, p, i) => i === 0 ? 0 : acc + haversineFt(measurePts[i - 1], p), 0)

  const selectedPolygon = activeTool === 'extrude' && selectedIds.length === 1
    ? features.find(f => f.properties.id === selectedIds[0] && f.geometry.type === 'Polygon')
    : null

  const token = (import.meta.env.VITE_MAPBOX_TOKEN ?? '').replace(/^﻿/, '').trim()

  return (
    <div ref={outerRef} style={{ position: 'absolute', inset: 0 }}>
      {/* Mapbox basemap */}
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* SVG feature overlay — purely visual, pointer-events none */}
      {map && (
        <svg
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
          width="100%" height="100%"
        >
          <g id="elements-layer">{renderFeatures()}</g>
          <g id="active-draw-layer">{renderActiveDraw()}</g>
          <g id="place-preview-layer">{renderPlacePreview()}</g>
          <g id="selection-layer">{renderSelection()}</g>

          {/* Rotate cursor hint */}
          {hoveredRotHandle && cursorPos && (
            <g transform={`translate(${cursorPos[0] + 10},${cursorPos[1] - 10})`} style={{ pointerEvents: 'none' }}>
              <path d="M0,9 A9,9,0,0,0,9,0" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M9,0 L6,-4 M9,0 L13,1" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/>
            </g>
          )}
          <g id="measure-layer">{renderMeasure()}</g>

          {/* Marquee selection box */}
          {marquee && (
            <rect
              x={Math.min(marquee.x1, marquee.x2)} y={Math.min(marquee.y1, marquee.y2)}
              width={Math.abs(marquee.x2 - marquee.x1)} height={Math.abs(marquee.y2 - marquee.y1)}
              fill="rgba(37,99,235,0.07)" stroke="#2563EB" strokeWidth={1} strokeDasharray="4 3" />
          )}
        </svg>
      )}

      {/* Interaction capture — on top of SVG, below UI panels */}
      {/* pointer-events:none in pan mode so Mapbox receives events directly */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 10,
          cursor,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onWheel={e => {
          const map = mapRef.current
          if (!map) return
          map.getCanvas().dispatchEvent(new WheelEvent('wheel', {
            bubbles: true,
            cancelable: e.cancelable,
            deltaX: e.nativeEvent.deltaX,
            deltaY: e.nativeEvent.deltaY,
            deltaZ: e.nativeEvent.deltaZ,
            deltaMode: e.nativeEvent.deltaMode,
            ctrlKey: e.nativeEvent.ctrlKey,
            clientX: e.nativeEvent.clientX,
            clientY: e.nativeEvent.clientY,
          }))
        }}
      />

      {/* ── UI overlays ──────────────────────────────────────────────────── */}

      {mapError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.85)', zIndex: 50 }}>
          <div style={{ background: '#1E293B', border: '1px solid #EF4444', borderRadius: 10, padding: '20px 28px', textAlign: 'center', color: '#fff', maxWidth: 340 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Map failed to load</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>{mapError}</div>
          </div>
        </div>
      )}

      {nightMode && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'rgba(10,15,35,0.52)', zIndex: 5 }} />
      )}

      {/* Map controls (top-right) */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <MapGeocoder token={token} mapRef={mapRef} />
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-bg-panel)', borderRadius: 8, border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
          {/* Location button */}
          <button
            onClick={() => navigator.geolocation?.getCurrentPosition(pos => {
              mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 15, duration: 800 })
            })}
            title="Go to my location"
            style={{ width: 36, height: 32, border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="10" opacity="0.3" /><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </button>
          <div style={{ height: 1, background: 'var(--color-border)' }} />
          {(Object.keys(MAP_STYLES) as (keyof typeof MAP_STYLES)[]).map(k => (
            <MapStyleBtn key={k} styleKey={k} active={mapStyle === k} onClick={() => setMapStyle(k)} />
          ))}
          <div style={{ height: 1, background: 'var(--color-border)' }} />
          <button
            onClick={() => {
              const m = mapRef.current
              if (!m) return
              setShowLabels(prev => {
                const n = !prev
                m.getStyle()?.layers?.forEach(l => {
                  if (l.type === 'symbol') m.setLayoutProperty(l.id, 'visibility', n ? 'visible' : 'none')
                })
                return n
              })
            }}
            title={showLabels ? 'Hide labels' : 'Show labels'}
            style={{ width: 36, height: 32, border: 'none', cursor: 'pointer', background: showLabels ? 'transparent' : 'var(--color-accent-subtle)', color: showLabels ? 'var(--color-text-muted)' : 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h10M4 17h7" /></svg>
          </button>
        </div>
      </div>

      <MapOrientationControl />

      {/* Canvas search */}
      {showCanvasSearch && (
        <CanvasSearchBar
          query={canvasSearchQuery} onQuery={setCanvasSearchQuery}
          onClose={toggleCanvasSearch} features={features}
          onSelect={id => setSelectedIds([id])} />
      )}

      {/* Draw hint */}
      {['pen', 'line', 'rect', 'ellipse', 'polygon'].includes(activeTool) && (
        <div style={{ position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 16, padding: '4px 14px', fontSize: 11, pointerEvents: 'none', zIndex: 20, backdropFilter: 'blur(6px)', whiteSpace: 'nowrap' }}>
          {activeTool === 'line'
            ? 'Click to add points · Double-click to finish · Esc to cancel'
            : activeTool === 'rect' || activeTool === 'ellipse'
              ? 'Click first corner · Click second corner to finish · Esc to cancel'
              : 'Click to add points · Click first point to close · Double-click to finish · Esc to cancel'}
        </div>
      )}

      {/* Text popup */}
      {textPopup && (
        <div style={{ position: 'absolute', left: textPopup.x - 130, top: textPopup.y - 48, zIndex: 40, background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            autoFocus value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && textInput.trim()) {
                addFeatureWithLayer(makeFeature(
                  { type: 'Point', coordinates: textPopup.lngLat }, 'text', 'annotations',
                  { label: textInput.trim(), style: { ...activeStyle, textContent: textInput.trim() } as typeof activeStyle },
                ))
                setTextPopup(null); setTextInput('')
              }
              if (e.key === 'Escape') { setTextPopup(null); setTextInput('') }
            }}
            placeholder="Type text…"
            style={{ width: 180, height: 28, padding: '0 8px', fontSize: 13, border: '1px solid var(--color-border)', borderRadius: 5, background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none' }} />
          <button
            onClick={() => {
              if (textInput.trim()) addFeatureWithLayer(makeFeature(
                { type: 'Point', coordinates: textPopup.lngLat }, 'text', 'annotations',
                { label: textInput.trim(), style: { ...activeStyle, textContent: textInput.trim() } as typeof activeStyle },
              ))
              setTextPopup(null); setTextInput('')
            }}
            style={{ height: 28, padding: '0 10px', fontSize: 12, fontWeight: 600, borderRadius: 5, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer' }}>Place</button>
        </div>
      )}

      {/* Measure labels */}
      {activeTool === 'measure' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
          {measureDistances.map((seg, i) => (
            <div key={i} style={{ position: 'absolute', left: seg.screen[0], top: seg.screen[1], transform: 'translate(-50%,-50%)', background: 'rgba(0,0,0,0.7)', color: '#F59E0B', borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {fmtDist(seg.d)}
            </div>
          ))}
          <div style={{ position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', color: '#fff', borderRadius: 16, padding: '4px 16px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {measurePts.length === 0
              ? 'Click to start measuring'
              : `Total: ${fmtDist(totalDist)} · Click to add points · Esc to clear`}
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{ position: 'absolute', left: contextMenu.x, top: contextMenu.y, zIndex: 60,
            background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)',
            borderRadius: 8, padding: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', minWidth: 168 }}
          onMouseDown={e => e.stopPropagation()}
        >
          {([
            { label: 'Duplicate', action: () => duplicateSelected() },
            { label: 'Bring to Front', action: () => { bringToFront(contextMenu.featureId); setContextMenu(null) } },
            { label: 'Send to Back',  action: () => { sendToBack(contextMenu.featureId);  setContextMenu(null) } },
            null,
            { label: 'Delete', action: () => { deleteFeatures([contextMenu.featureId]); setContextMenu(null) }, danger: true },
          ] as Array<{ label: string; action: () => void; danger?: boolean } | null>).map((item, i) =>
            item === null
              ? <div key={i} style={{ height: 1, background: 'var(--color-border)', margin: '4px 0' }} />
              : <button key={i} onClick={item.action}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px',
                    fontSize: 13, border: 'none', borderRadius: 5, cursor: 'pointer',
                    background: 'transparent', color: item.danger ? '#EF4444' : 'var(--color-text)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-accent-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >{item.label}</button>
          )}
        </div>
      )}

      {/* Extrude panel */}
      {selectedPolygon && (
        <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 20px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 240 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>Extrude to 3D</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min={0} max={200} step={1} value={extrudeHeight}
              onChange={e => { const h = +e.target.value; setExtrudeHeight(h); applyExtrude(h) }}
              style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 50 }}>{extrudeHeight} m</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[10, 20, 30, 50, 100].map(h => (
              <button key={h} onClick={() => { setExtrudeHeight(h); applyExtrude(h) }}
                style={{ flex: 1, height: 24, fontSize: 10, fontWeight: 600, borderRadius: 4, border: '1px solid var(--color-border)', background: extrudeHeight === h ? 'var(--color-accent-subtle)' : 'transparent', color: extrudeHeight === h ? 'var(--color-accent)' : 'var(--color-text-muted)', cursor: 'pointer' }}>
                {h}m</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── MapStyleBtn ──────────────────────────────────────────────────────────────

function MapStyleBtn({ styleKey, active, onClick }: { styleKey: string; active: boolean; onClick: () => void }) {
  const icons: Record<string, React.ReactNode> = {
    satellite: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="4" y="4" width="7" height="7" rx="1" opacity="0.7" /><rect x="13" y="4" width="7" height="7" rx="1" opacity="0.4" /><rect x="4" y="13" width="7" height="7" rx="1" opacity="0.4" /><rect x="13" y="13" width="7" height="7" rx="1" opacity="0.7" /><line x1="4" y1="10" x2="20" y2="10" /><line x1="10" y1="4" x2="10" y2="20" /></svg>,
    streets: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="3" x2="12" y2="21" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="5.6" y1="5.6" x2="18.4" y2="18.4" opacity="0.4" /><line x1="18.4" y1="5.6" x2="5.6" y2="18.4" opacity="0.4" /></svg>,
    light: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><line x1="12" y1="2" x2="12" y2="5" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="2" y1="12" x2="5" y2="12" /><line x1="19" y1="12" x2="22" y2="12" /></svg>,
  }
  return (
    <button onClick={onClick} title={styleKey}
      style={{ width: 36, height: 32, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--color-accent-subtle)' : 'transparent', color: active ? 'var(--color-accent)' : 'var(--color-text-muted)', transition: 'all 100ms' }}>
      {icons[styleKey]}
    </button>
  )
}

// ── MapGeocoder ───────────────────────────────────────────────────────────────

function MapGeocoder({ token, mapRef }: { token: string; mapRef: React.MutableRefObject<mapboxgl.Map | null> }) {
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; place_name: string; center: [number, number] }>>([])
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=5&types=place,address,poi`)
        const d = await r.json()
        setResults(d.features ?? [])
        setOpen(true)
      } catch { setResults([]) }
    }, 350)
    return () => clearTimeout(t)
  }, [query, token])

  function flyTo(center: [number, number]) {
    mapRef.current?.flyTo({ center, zoom: 15, duration: 1200 })
    setQuery(''); setResults([]); setOpen(false); setExpanded(false)
  }

  function collapse() {
    setTimeout(() => { setOpen(false); setExpanded(false); setQuery(''); setResults([]) }, 150)
  }

  if (!expanded) {
    return (
      <button
        onClick={() => { setExpanded(true); setTimeout(() => inputRef.current?.focus(), 30) }}
        title="Search location"
        style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', color: 'var(--color-text-muted)' }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
      </button>
    )
  }

  return (
    <div style={{ width: 260 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <svg style={{ position: 'absolute', left: 9, pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); if (!e.target.value) setOpen(false) }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={collapse}
          onKeyDown={e => { if (e.key === 'Escape') collapse() }}
          placeholder="Search location…"
          style={{ width: '100%', height: 34, padding: '0 28px 0 30px', fontSize: 12, border: 'none', background: 'transparent', color: 'var(--color-text)', outline: 'none', borderRadius: 8 }} />
        <button onClick={collapse}
          style={{ position: 'absolute', right: 6, width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14 }}>×</button>
      </div>
      {open && results.length > 0 && (
        <div style={{ marginTop: 4, background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
          {results.map(r => (
            <div key={r.id} onMouseDown={() => flyTo(r.center)}
              style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', lineHeight: 1.3 }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {r.place_name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── CanvasSearchBar ───────────────────────────────────────────────────────────

function CanvasSearchBar({ query, onQuery, onClose, features, onSelect }: {
  query: string; onQuery: (q: string) => void; onClose: () => void;
  features: UMPFeature[]; onSelect: (id: string) => void
}) {
  const q = query.trim().toLowerCase()
  const results = q ? features.filter(f => f.properties.label.toLowerCase().includes(q)).slice(0, 8) : []
  return (
    <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: 'var(--color-bg-panel)', borderRadius: 10, border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', minWidth: 320 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, borderBottom: results.length ? '1px solid var(--color-border)' : 'none' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input autoFocus value={query} onChange={e => onQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          placeholder="Search features…"
          style={{ flex: 1, height: 40, border: 'none', background: 'transparent', fontSize: 13, color: 'var(--color-text)', outline: 'none' }} />
        <button onClick={onClose} style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14 }}>✕</button>
      </div>
      {results.map(f => (
        <div key={f.properties.id} onClick={() => { onSelect(f.properties.id); onClose() }}
          style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--color-border)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: f.properties.style.strokeColor, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{f.properties.label}</span>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{f.properties.elementType}</span>
        </div>
      ))}
      {q && results.length === 0 && (
        <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--color-text-muted)' }}>No features found</div>
      )}
    </div>
  )
}
