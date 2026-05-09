import React, { useEffect, useRef, useState, useCallback } from 'react'
import mapboxgl from 'mapbox-gl'
import { useMapStore } from '../store/mapStore'
import { useUIStore } from '../store/uiStore'
import { useCanvasStore, makeFeature } from '../store/canvasStore'
import type { UMPFeature } from '../store/canvasStore'
import { useLayersStore } from '../store/layersStore'
import { MapOrientationControl } from './components/MapOrientationControl'
import { ELEMENT_CATEGORIES } from '../elements/categories'
import {
  lngLatToScreen, screenToLngLat, haversineFt, fmtDist,
  distToSegment, pointInPolygon, screenBbox,
} from '../utils/geo'

const INITIAL_CENTER: [number, number] = [-87.6298, 41.8781]
const INITIAL_ZOOM = 15

const MAP_STYLES: Record<string, string> = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets:   'mapbox://styles/mapbox/streets-v12',
  light:     'mapbox://styles/mapbox/light-v11',
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

  // Selection / node editing
  const [draggingNode, setDraggingNode] = useState<{ featureId: string; path: number[] } | null>(null)
  const [hoveredFeatureId, setHoveredFeatureId] = useState<string | null>(null)
  const [hoveredVertIdx, setHoveredVertIdx] = useState<number | null>(null)

  // Marquee
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const mouseDownOnFeatureRef = useRef(false)

  // Measure
  const [measurePts, setMeasurePts] = useState<[number, number][]>([])

  // Text
  const [textPopup, setTextPopup] = useState<{ x: number; y: number; lngLat: [number, number] } | null>(null)
  const [textInput, setTextInput] = useState('')

  // Extrude
  const [extrudeHeight, setExtrudeHeight] = useState(0)

  const { setMapInstance, setZoom, setCenter, setRotation, setPitch } = useMapStore()
  const {
    activeTool, setActiveTool, activeStyle, activeElementType,
    nightMode, mode3D, showCanvasSearch, canvasSearchQuery,
    setCanvasSearchQuery, toggleCanvasSearch,
  } = useUIStore()
  const { features, selectedIds, addFeature, updateGeometry, updateFeature, deleteFeatures, setSelectedIds } = useCanvasStore()
  const { layers } = useLayersStore()

  // Refs for use in callbacks (avoid stale closures)
  const activeToolRef = useRef(activeTool)
  const featuresRef = useRef(features)
  const selectedIdsRef = useRef(selectedIds)
  const activeStyleRef = useRef(activeStyle)
  const activeElementTypeRef = useRef(activeElementType)
  const drawNodesRef = useRef(drawNodes)
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { featuresRef.current = features }, [features])
  useEffect(() => { selectedIdsRef.current = selectedIds }, [selectedIds])
  useEffect(() => { activeStyleRef.current = activeStyle }, [activeStyle])
  useEffect(() => { activeElementTypeRef.current = activeElementType }, [activeElementType])
  useEffect(() => { drawNodesRef.current = drawNodes }, [drawNodes])

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
    if (drawingTools.includes(activeTool)) {
      map.dragPan.disable()
    } else {
      map.dragPan.enable()
    }
  }, [activeTool])

  // Cancel drawing state on tool switch
  useEffect(() => {
    setDrawNodes([])
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
          case 'a': setActiveTool('direct'); break
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
            setCursorPos(null)
            setMeasurePts([])
            setActiveTool('select')
            setSelectedIds([])
            break
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

    if (tool === 'select' || tool === 'direct') {
      // Check vertex handles first
      const selId = selectedIdsRef.current[0]
      if (selId) {
        const selFeat = featuresRef.current.find(f => f.properties.id === selId)
        if (selFeat) {
          const verts = getVertices(selFeat.geometry)
          for (const v of verts) {
            const [vx, vy] = lngLatToScreen(map, v.coord)
            if (Math.hypot(vx - sx, vy - sy) < 9) {
              setDraggingNode({ featureId: selId, path: v.path })
              mouseDownOnFeatureRef.current = true
              e.stopPropagation()
              return
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
        // Don't select here; select on click (to distinguish drag vs click)
        return
      }
      // Start marquee
      setMarquee({ x1: sx, y1: sy, x2: sx, y2: sy })
    }
  }, [getCanvasXY, layers])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const map = mapRef.current
    if (!map) return
    const [sx, sy] = getCanvasXY(e)
    const lngLat = screenToLngLat(map, sx, sy)
    setCursorPos([sx, sy])

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
      // Check vertex hover
      const selId = selectedIdsRef.current[0]
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
  }, [getCanvasXY, draggingNode, marquee, updateGeometry, layers])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const map = mapRef.current
    if (!map) return
    const [sx, sy] = getCanvasXY(e)

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
  }, [getCanvasXY, draggingNode, marquee, setSelectedIds])

  const handleClick = useCallback((e: React.MouseEvent) => {
    const map = mapRef.current
    if (!map) return
    // Skip if we were dragging a marquee
    if (marquee) return
    if (draggingNode) return

    const [sx, sy] = getCanvasXY(e)
    const lngLat = screenToLngLat(map, sx, sy)
    const tool = activeToolRef.current

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
          setSelectedIds([hit.properties.id])
        }
        return
      }

      // Click-to-place for 'place' drawMode elements
      const elType = activeElementTypeRef.current
      if (elType) {
        const el = ELEMENT_CATEGORIES.flatMap(c => c.elements).find(x => x.id === elType)
        if (el?.drawMode === 'place') {
          addFeature(makeFeature(
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
      setDrawNodes(prev => [...prev, lngLat])
      return
    }

    if (tool === 'polygon' || tool === 'pen') {
      const prev = drawNodesRef.current
      // Check close-to-first-node
      if (prev.length >= 3) {
        const [fx, fy] = lngLatToScreen(map, prev[0])
        if (Math.hypot(fx - sx, fy - sy) < 12) {
          finishPolygon(prev)
          return
        }
      }
      setDrawNodes(p => [...p, lngLat])
      return
    }

    if (tool === 'rect') {
      setDrawNodes(prev => {
        if (prev.length === 0) return [lngLat]
        finishRect(prev[0], lngLat)
        return []
      })
      return
    }

    if (tool === 'ellipse') {
      setDrawNodes(prev => {
        if (prev.length === 0) return [lngLat]
        finishEllipse(prev[0], lngLat)
        return []
      })
      return
    }
  }, [getCanvasXY, marquee, draggingNode, addFeature, setSelectedIds, layers])

  const handleDoubleClick = useCallback(() => {
    const tool = activeToolRef.current
    const nodes = drawNodesRef.current
    if (tool === 'line' && nodes.length >= 2) { finishLine(nodes); return }
    if ((tool === 'polygon' || tool === 'pen') && nodes.length >= 3) { finishPolygon(nodes); return }
  }, [])

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
    addFeature(makeElFeature({ type: 'LineString', coordinates: nodes }, 'line', 'custom'))
    setDrawNodes([])
  }

  function finishPolygon(nodes: [number, number][]) {
    if (nodes.length < 3) return
    addFeature(makeElFeature({ type: 'Polygon', coordinates: [[...nodes, nodes[0]]] }, 'polygon', 'custom'))
    setDrawNodes([])
  }

  function finishRect(p1: [number, number], p2: [number, number]) {
    const coords: [number, number][] = [p1, [p2[0], p1[1]], p2, [p1[0], p2[1]], p1]
    addFeature(makeElFeature({ type: 'Polygon', coordinates: [coords] }, 'rect', 'custom'))
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
    addFeature(makeElFeature({ type: 'Polygon', coordinates: [pts] }, 'ellipse', 'custom'))
    setDrawNodes([])
  }

  function applyExtrude(height: number) {
    if (!selectedIds[0]) return
    const f = features.find(x => x.properties.id === selectedIds[0])
    if (!f) return
    updateFeature(f.properties.id, { style: { ...f.properties.style, extrudeHeight: height } })
  }

  // ── Cursor ────────────────────────────────────────────────────────────────
  const CURSORS: Record<string, string> = {
    select: 'default', direct: 'default', pen: 'crosshair', line: 'crosshair',
    rect: 'crosshair', ellipse: 'crosshair', polygon: 'crosshair',
    text: 'text', measure: 'crosshair', extrude: 'default',
  }
  let cursor = CURSORS[activeTool] ?? 'default'
  if (draggingNode) cursor = 'crosshair'
  else if (hoveredVertIdx !== null) cursor = 'grab'
  else if (hoveredFeatureId && (activeTool === 'select' || activeTool === 'direct')) cursor = 'pointer'

  // ── SVG rendering ─────────────────────────────────────────────────────────
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
        // Point symbol
        return (
          <g key={f.properties.id} style={{ pointerEvents: 'none' }}>
            <circle cx={px} cy={py} r={8} fill={style.fillColor ?? '#2563EB'} stroke={strokeColor} strokeWidth={isSelected ? 2.5 : 1.5} />
            {isSelected && <circle cx={px} cy={py} r={12} fill="none" stroke={selColor} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />}
          </g>
        )
      }

      const path = geomToScreenPath(map, f.geometry)
      const isLine = f.geometry.type === 'LineString'
      const sw = style.strokeWidth ?? 2

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

  function renderActiveDraw() {
    if (!map || !cursorPos) return null
    const [cx, cy] = cursorPos
    const tool = activeTool

    if ((tool === 'pen' || tool === 'polygon') && drawNodes.length > 0) {
      const pts = drawNodes.map(n => lngLatToScreen(map, n))
      const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
      return (
        <g style={{ pointerEvents: 'none' }}>
          <path d={`${d} L ${cx} ${cy}`} fill="none" stroke="#2563EB" strokeWidth={2} strokeDasharray="6 4" opacity={0.85} />
          {drawNodes.length >= 3 && (
            <line x1={cx} y1={cy} x2={pts[0][0]} y2={pts[0][1]} stroke="#2563EB" strokeWidth={1} strokeDasharray="4 4" opacity={0.4} />
          )}
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4} fill="white" stroke="#2563EB" strokeWidth={1.5} />
          ))}
          {drawNodes.length >= 3 && (
            <circle cx={pts[0][0]} cy={pts[0][1]} r={9} fill="none" stroke="#2563EB" strokeWidth={1.5} opacity={0.55} />
          )}
        </g>
      )
    }

    if (tool === 'line' && drawNodes.length > 0) {
      const pts = drawNodes.map(n => lngLatToScreen(map, n))
      const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
      return (
        <g style={{ pointerEvents: 'none' }}>
          <path d={`${d} L ${cx} ${cy}`} fill="none" stroke="#2563EB" strokeWidth={2} strokeDasharray="6 4" />
          {pts.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={4} fill="white" stroke="#2563EB" strokeWidth={1.5} />
          ))}
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

      return (
        <g key={`sel-${id}`} style={{ pointerEvents: 'none' }}>
          {/* Bounding box */}
          {(() => {
            const bb = screenBbox(screenVerts)
            if (bb.w < 2 && bb.h < 2) return null
            return (
              <rect x={bb.x - 6} y={bb.y - 6} width={bb.w + 12} height={bb.h + 12}
                fill="none" stroke="#2563EB" strokeWidth={1} strokeDasharray="4 3" opacity={0.5} />
            )
          })()}
          {/* Vertex handles */}
          {screenVerts.map(([vx, vy], i) => (
            <g key={i}>
              <circle cx={vx} cy={vy} r={4.5} fill="white" stroke="#2563EB" strokeWidth={1.5}
                style={{ filter: hoveredVertIdx === i ? 'drop-shadow(0 0 3px #2563EB)' : undefined }} />
            </g>
          ))}
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
          <g id="selection-layer">{renderSelection()}</g>
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
      <div
        style={{ position: 'absolute', inset: 0, cursor, zIndex: 10 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
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
                addFeature(makeFeature(
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
              if (textInput.trim()) addFeature(makeFeature(
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
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; place_name: string; center: [number, number] }>>([])
  const [open, setOpen] = useState(false)

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
    setQuery(''); setResults([]); setOpen(false)
  }

  return (
    <div style={{ width: 260 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <svg style={{ position: 'absolute', left: 9, pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input value={query} onChange={e => { setQuery(e.target.value); if (!e.target.value) setOpen(false) }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search location…"
          style={{ width: '100%', height: 34, padding: '0 28px 0 30px', fontSize: 12, border: 'none', background: 'transparent', color: 'var(--color-text)', outline: 'none', borderRadius: 8 }} />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            style={{ position: 'absolute', right: 6, width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14 }}>×</button>
        )}
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
