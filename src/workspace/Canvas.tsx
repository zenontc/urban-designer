import React, { useEffect, useRef, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { useMapStore } from '../store/mapStore'
import { useUIStore } from '../store/uiStore'
import { useCanvasStore, makeFeature } from '../store/canvasStore'
import type { UMPFeature } from '../store/canvasStore'
import { useLayersStore } from '../store/layersStore'
import { MapOrientationControl } from './components/MapOrientationControl'
import { ELEMENT_CATEGORIES } from '../elements/categories'

const INITIAL_CENTER: [number, number] = [-87.6298, 41.8781]
const INITIAL_ZOOM = 15

const MAP_STYLES: Record<string, string> = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets:   'mapbox://styles/mapbox/streets-v12',
  light:     'mapbox://styles/mapbox/light-v11',
}

const DRAW_STYLES = [
  { id: 'gl-draw-polygon-fill',    type: 'fill',   filter: ['all', ['==', '$type', 'Polygon'],    ['!=', 'mode', 'static']], paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.15 } },
  { id: 'gl-draw-polygon-stroke',  type: 'line',   filter: ['all', ['==', '$type', 'Polygon'],    ['!=', 'mode', 'static']], paint: { 'line-color': '#2563EB', 'line-width': 2 } },
  { id: 'gl-draw-line',            type: 'line',   filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']], paint: { 'line-color': '#2563EB', 'line-width': 2 } },
  { id: 'gl-draw-point',           type: 'circle', filter: ['all', ['==', '$type', 'Point'],      ['!=', 'mode', 'static']], paint: { 'circle-radius': 5, 'circle-color': '#2563EB' } },
  { id: 'gl-draw-polygon-midpoint',type: 'circle', filter: ['all', ['==', '$type', 'Point'],      ['==', 'meta', 'midpoint']], paint: { 'circle-radius': 4, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#2563EB' } },
  { id: 'gl-draw-vertex',          type: 'circle', filter: ['all', ['==', '$type', 'Point'],      ['==', 'meta', 'vertex']], paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#2563EB' } },
  { id: 'gl-draw-polygon-fill-st', type: 'fill',   filter: ['all', ['==', '$type', 'Polygon'],    ['==', 'mode', 'static']], paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.1 } },
  { id: 'gl-draw-polygon-stroke-st', type: 'line', filter: ['all', ['==', '$type', 'Polygon'],    ['==', 'mode', 'static']], paint: { 'line-color': '#2563EB', 'line-width': 2 } },
  { id: 'gl-draw-line-st',         type: 'line',   filter: ['all', ['==', '$type', 'LineString'], ['==', 'mode', 'static']], paint: { 'line-color': '#2563EB', 'line-width': 2 } },
  { id: 'gl-draw-point-st',        type: 'circle', filter: ['all', ['==', '$type', 'Point'],      ['==', 'mode', 'static']], paint: { 'circle-radius': 5, 'circle-color': '#2563EB' } },
]

// Haversine distance in feet between two [lng, lat] coords
function distFt(a: [number, number], b: [number, number]): number {
  const R = 20902231 // earth radius in feet
  const dLat = (b[1] - a[1]) * Math.PI / 180
  const dLon = (b[0] - a[0]) * Math.PI / 180
  const sin2 = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * Math.PI / 180) * Math.cos(b[1] * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(sin2))
}

function fmtDist(ft: number): string {
  if (ft < 5280) return `${Math.round(ft)} ft`
  return `${(ft / 5280).toFixed(2)} mi`
}

// Extract editable vertex GeoJSON points from a feature
function extractVertexFeatures(f: UMPFeature): GeoJSON.Feature[] {
  const g = f.geometry
  const verts: GeoJSON.Feature[] = []
  const push = (c: number[], path: number[]) =>
    verts.push({ type: 'Feature', id: `v-${f.properties.id}-${path.join('-')}`, geometry: { type: 'Point', coordinates: c }, properties: { featureId: f.properties.id, path: JSON.stringify(path) } })

  if (g.type === 'Point') { push(g.coordinates as number[], []); return verts }
  if (g.type === 'LineString') {
    (g.coordinates as number[][]).forEach((c, i) => push(c, [i]))
    return verts
  }
  if (g.type === 'Polygon') {
    const ring = g.coordinates[0] as number[][]
    for (let i = 0; i < ring.length - 1; i++) push(ring[i], [0, i])
    return verts
  }
  return verts
}

// Deep-update a coordinate in a geometry copy
function updateCoordInGeom(geom: GeoJSON.Geometry, path: number[], newCoord: [number, number]): GeoJSON.Geometry {
  const g = JSON.parse(JSON.stringify(geom)) as GeoJSON.Geometry
  if (g.type === 'Point') { (g as GeoJSON.Point).coordinates = newCoord; return g }
  if (g.type === 'LineString') { (g as GeoJSON.LineString).coordinates[path[0]] = newCoord; return g }
  if (g.type === 'Polygon') {
    const ring = (g as GeoJSON.Polygon).coordinates[path[0]]
    ring[path[1]] = newCoord
    // Keep polygon closed
    if (path[1] === 0) ring[ring.length - 1] = newCoord
    return g
  }
  return g
}

function addFeatureLayers(map: mapboxgl.Map) {
  if (map.getSource('ump-features')) return

  for (const id of ['ump-features', 'ump-selected', 'ump-glow', 'ump-labels', 'ump-vertices', 'ump-measure', 'ump-extruded']) {
    map.addSource(id, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  }

  // Feature layers
  map.addLayer({ id: 'ump-fill', type: 'fill', source: 'ump-features', filter: ['==', '$type', 'Polygon'],
    paint: { 'fill-color': ['coalesce', ['get', 'fillColor', ['get', 'style']], '#2563EB'], 'fill-opacity': ['/', ['coalesce', ['get', 'fillOpacity', ['get', 'style']], 70], 100] } })
  map.addLayer({ id: 'ump-line', type: 'line', source: 'ump-features',
    paint: { 'line-color': ['coalesce', ['get', 'strokeColor', ['get', 'style']], '#2563EB'], 'line-width': ['coalesce', ['get', 'strokeWidth', ['get', 'style']], 2] } })
  map.addLayer({ id: 'ump-point', type: 'circle', source: 'ump-features', filter: ['==', '$type', 'Point'],
    paint: { 'circle-radius': 6, 'circle-color': ['coalesce', ['get', 'strokeColor', ['get', 'style']], '#2563EB'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })

  // 3D extrusion layer
  map.addLayer({ id: 'ump-extrusion', type: 'fill-extrusion', source: 'ump-extruded',
    paint: {
      'fill-extrusion-color': ['coalesce', ['get', 'fillColor', ['get', 'style']], '#334155'],
      'fill-extrusion-height': ['coalesce', ['get', 'extrudeHeight', ['get', 'style']], 10],
      'fill-extrusion-base': 0,
      'fill-extrusion-opacity': 0.85,
    } })

  // Text labels
  map.addLayer({ id: 'ump-labels', type: 'symbol', source: 'ump-labels',
    layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
    paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 1.5 } })

  // Text element layer
  map.addLayer({ id: 'ump-text', type: 'symbol', source: 'ump-features',
    filter: ['==', ['get', 'elementType'], 'text'],
    layout: { 'text-field': ['coalesce', ['get', 'textContent', ['get', 'style']], ['get', 'label']], 'text-size': ['coalesce', ['get', 'fontSize', ['get', 'style']], 16], 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'] },
    paint: { 'text-color': ['coalesce', ['get', 'strokeColor', ['get', 'style']], '#ffffff'], 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 2 } })

  // Selection highlight
  map.addLayer({ id: 'ump-sel-fill', type: 'fill',   source: 'ump-selected', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.2 } })
  map.addLayer({ id: 'ump-sel-line', type: 'line',   source: 'ump-selected', paint: { 'line-color': '#F59E0B', 'line-width': 3, 'line-dasharray': [2, 1] } })
  map.addLayer({ id: 'ump-sel-point', type: 'circle', source: 'ump-selected', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 8, 'circle-color': '#F59E0B', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })

  // Glow
  map.addLayer({ id: 'ump-glow', type: 'circle', source: 'ump-glow',
    paint: { 'circle-radius': 20, 'circle-color': '#FBBF24', 'circle-opacity': 0, 'circle-blur': 1 } })

  // Vertex handle dots (for node editing)
  map.addLayer({ id: 'ump-vertices', type: 'circle', source: 'ump-vertices',
    paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-width': 2.5, 'circle-stroke-color': '#2563EB', 'circle-stroke-opacity': 0.9 } })

  // Measure line
  map.addLayer({ id: 'ump-measure-line', type: 'line', source: 'ump-measure',
    filter: ['==', '$type', 'LineString'],
    paint: { 'line-color': '#F59E0B', 'line-width': 2, 'line-dasharray': [4, 3] } })
  map.addLayer({ id: 'ump-measure-pts', type: 'circle', source: 'ump-measure',
    filter: ['==', '$type', 'Point'],
    paint: { 'circle-radius': 5, 'circle-color': '#F59E0B', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })
}

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const drawRef = useRef<InstanceType<typeof MapboxDraw> | null>(null)
  const styleLoadedRef = useRef(false)
  const mapStyleInitialized = useRef(false)
  const activeToolRef = useRef('select')
  const featuresRef = useRef<UMPFeature[]>([])
  const activeStyleRef = useRef(useUIStore.getState().activeStyle)
  const activeElementTypeRef = useRef<string | null>(null)
  const vertexDragRef = useRef<{ featureId: string; path: number[] } | null>(null)
  // Marquee box-select
  const marqueeRef = useRef<{ startX: number; startY: number } | null>(null)

  const [mapError, setMapError] = useState<string | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [mapStyle, setMapStyle] = useState<keyof typeof MAP_STYLES>('satellite')
  // Text placement
  const [textPopup, setTextPopup] = useState<{ x: number; y: number; lngLat: [number, number] } | null>(null)
  const [textInput, setTextInput] = useState('')
  // Measure
  const [measurePts, setMeasurePts] = useState<[number, number][]>([])
  // Marquee overlay
  const [marqueeBox, setMarqueeBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  // Extrude height for selected polygon
  const [extrudeHeight, setExtrudeHeight] = useState(0)

  const { setMapInstance, setZoom, setCenter, setRotation, setPitch } = useMapStore()
  const { nightMode, mode3D, activeTool, activeStyle, activeElementType } = useUIStore()
  const { addFeature, updateGeometry, deleteFeatures, setSelectedIds, features, selectedIds } = useCanvasStore()
  const { layers } = useLayersStore()
  const { showCanvasSearch, canvasSearchQuery, setCanvasSearchQuery, toggleCanvasSearch } = useUIStore()

  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { featuresRef.current = features }, [features])
  useEffect(() => { activeStyleRef.current = activeStyle }, [activeStyle])
  useEffect(() => { activeElementTypeRef.current = activeElementType }, [activeElementType])

  // When a polygon is selected and extrude tool is active, sync height from feature style
  useEffect(() => {
    if (activeTool === 'extrude' && selectedIds.length === 1) {
      const f = features.find(x => x.properties.id === selectedIds[0])
      const h = f?.properties.style?.extrudeHeight ?? 0
      setExtrudeHeight(h)
    }
  }, [activeTool, selectedIds, features])

  // Cmd+F
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); toggleCanvasSearch() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleCanvasSearch])

  // ── Init ─────────────────────────────────────────────────────────────────
  const initMap = useCallback(() => {
    if (!containerRef.current || mapRef.current) return
    const token = (import.meta.env.VITE_MAPBOX_TOKEN ?? '').replace(/^﻿/, '').trim()
    if (!token) { setMapError('Missing VITE_MAPBOX_TOKEN in .env'); return }
    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: containerRef.current, style: MAP_STYLES.satellite,
      center: INITIAL_CENTER, zoom: INITIAL_ZOOM,
      antialias: true, fadeDuration: 0, preserveDrawingBuffer: true,
    })

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      styles: DRAW_STYLES as any[],
    })

    map.addControl(draw as unknown as mapboxgl.IControl)
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right')
    map.addControl(new mapboxgl.ScaleControl({ unit: 'imperial' }), 'bottom-left')

    map.on('load', () => {
      addFeatureLayers(map)
      styleLoadedRef.current = true
      mapStyleInitialized.current = true
      setMapInstance(map)
      setMapError(null)
    })
    map.on('error', (e) => {
      const msg = e.error?.message ?? ''
      if (msg.includes('401') || msg.includes('token') || msg.includes('Unauthorized'))
        setMapError('Invalid Mapbox token. Check your .env file.')
    })
    map.on('style.load', () => {
      styleLoadedRef.current = true
      addFeatureLayers(map)
      syncFeaturesTo(map)
    })

    // ── Select: click on feature ──────────────────────────────────────────
    const selectLayers = ['ump-fill', 'ump-line', 'ump-point']
    selectLayers.forEach(layer => {
      map.on('click', layer, (e) => {
        const id = e.features?.[0]?.properties?.id as string | undefined
        if (!id) return
        const tool = activeToolRef.current
        if (tool === 'select' || tool === 'direct') {
          setSelectedIds([id])
          e.originalEvent.stopPropagation()
        } else if (tool === 'extrude') {
          setSelectedIds([id])
          e.originalEvent.stopPropagation()
        }
      })
      map.on('mouseenter', layer, () => {
        const t = activeToolRef.current
        if (t === 'select' || t === 'direct' || t === 'extrude') map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', layer, () => {
        if (!vertexDragRef.current) map.getCanvas().style.cursor = activeToolRef.current === 'text' ? 'crosshair' : ''
      })
    })

    // ── Background click ─────────────────────────────────────────────────
    map.on('click', (e) => {
      const tool = activeToolRef.current

      if (tool === 'text') {
        const rect = containerRef.current?.getBoundingClientRect()
        setTextPopup({ x: e.point.x + (rect?.left ?? 0), y: e.point.y + (rect?.top ?? 0), lngLat: [e.lngLat.lng, e.lngLat.lat] })
        return
      }

      if (tool === 'measure') {
        const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat]
        setMeasurePts(prev => {
          const next = [...prev, pt]
          updateMeasureSource(map, next)
          return next
        })
        return
      }

      // 'place' mode: click to place the active element as a point
      if (tool === 'select' && activeElementTypeRef.current) {
        const el = ELEMENT_CATEGORIES.flatMap(c => c.elements).find(e => e.id === activeElementTypeRef.current)
        if (el && el.drawMode === 'place') {
          const feat = makeFeature(
            { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] },
            el.id, el.category,
            { style: activeStyleRef.current, label: el.label },
          )
          addFeature(feat)
          return
        }
      }

      if (tool === 'select' || tool === 'direct') setSelectedIds([])
    })

    // ── Vertex drag ───────────────────────────────────────────────────────
    map.on('mousedown', 'ump-vertices', (e) => {
      if (activeToolRef.current !== 'select') return
      e.preventDefault()
      const props = e.features?.[0]?.properties
      if (!props) return
      vertexDragRef.current = { featureId: props.featureId, path: JSON.parse(props.path as string) }
      map.dragPan.disable()
      map.getCanvas().style.cursor = 'crosshair'
    })

    map.on('mousemove', (e) => {
      if (!vertexDragRef.current) return
      const { featureId, path } = vertexDragRef.current
      const feat = featuresRef.current.find(f => f.properties.id === featureId)
      if (!feat) return
      const newCoord: [number, number] = [e.lngLat.lng, e.lngLat.lat]
      const updatedGeom = updateCoordInGeom(feat.geometry, path, newCoord)
      const updatedFeat = { ...feat, geometry: updatedGeom } as UMPFeature
      // Live preview: update map sources directly without React state
      const src = map.getSource('ump-features') as mapboxgl.GeoJSONSource
      const others = featuresRef.current.filter(f => f.properties.id !== featureId)
      src?.setData({ type: 'FeatureCollection', features: [...others, updatedFeat] })
      const vSrc = map.getSource('ump-vertices') as mapboxgl.GeoJSONSource
      vSrc?.setData({ type: 'FeatureCollection', features: extractVertexFeatures(updatedFeat) })
    })

    map.on('mouseup', (e) => {
      if (!vertexDragRef.current) return
      const { featureId, path } = vertexDragRef.current
      const feat = featuresRef.current.find(f => f.properties.id === featureId)
      if (feat) updateGeometry(featureId, updateCoordInGeom(feat.geometry, path, [e.lngLat.lng, e.lngLat.lat]))
      vertexDragRef.current = null
      map.dragPan.enable()
      map.getCanvas().style.cursor = 'pointer'
    })

    // ── Draw events ───────────────────────────────────────────────────────
    type DrawEvent = { features: GeoJSON.Feature[] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ma = map as any
    ma.on('draw.create', (e: DrawEvent) => {
      e.features.forEach(geom => {
        const elType = activeElementTypeRef.current ?? 'generic'
        // Find the element's category
        const el = ELEMENT_CATEGORIES.flatMap(c => c.elements).find(x => x.id === elType)
        const cat = el?.category ?? 'custom'
        const feat = makeFeature(geom.geometry, elType, cat, { style: activeStyleRef.current, label: el?.label ?? elType })
        addFeature(feat)
        draw.delete(geom.id as string)
      })
    })
    ma.on('draw.update', (e: DrawEvent) => {
      e.features.forEach(f => updateGeometry(f.id as string, f.geometry))
    })
    ma.on('draw.delete', (e: DrawEvent) => {
      deleteFeatures(e.features.map(f => f.id as string))
    })

    map.on('move', () => {
      const c = map.getCenter()
      setCenter([c.lng, c.lat]); setZoom(map.getZoom()); setRotation(map.getBearing()); setPitch(map.getPitch())
    })

    mapRef.current = map
    drawRef.current = draw
  }, [setMapInstance, setZoom, setCenter, setRotation, setPitch, addFeature, updateGeometry, deleteFeatures, setSelectedIds])

  useEffect(() => {
    initMap()
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; drawRef.current = null; setMapInstance(null) } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tool mode switching ────────────────────────────────────────────────
  useEffect(() => {
    const draw = drawRef.current
    const map = mapRef.current
    if (!draw || !map) return
    const canvas = map.getCanvas()
    canvas.style.cursor = activeTool === 'text' ? 'crosshair' : activeTool === 'measure' ? 'crosshair' : ''

    const DRAW_MODES: Record<string, string> = {
      select: 'simple_select', direct: 'simple_select',
      pen: 'draw_polygon', line: 'draw_line_string',
      rect: 'draw_polygon', ellipse: 'draw_polygon', polygon: 'draw_polygon',
      text: 'simple_select', extrude: 'simple_select', measure: 'simple_select',
      addNode: 'direct_select', delNode: 'direct_select',
    }
    try { draw.changeMode(DRAW_MODES[activeTool] ?? 'simple_select') } catch { /* ignore */ }

    // Clear measure when switching away
    if (activeTool !== 'measure') {
      setMeasurePts([])
      const mSrc = map.getSource('ump-measure') as mapboxgl.GeoJSONSource
      mSrc?.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [activeTool])

  // ── Sync features + vertices ───────────────────────────────────────────
  function syncFeaturesTo(map: mapboxgl.Map) {
    const hidden = new Set(layers.filter(l => !l.visible).map(l => l.id))
    const q = canvasSearchQuery.trim().toLowerCase()
    const visible = features.filter(f => !hidden.has(f.properties.layerGroup))
    const hits = q ? visible.filter(f => f.properties.label.toLowerCase().includes(q)) : []
    const selected = visible.filter(f => selectedIds.includes(f.properties.id) || hits.some(h => h.properties.id === f.properties.id))
    const extruded = visible.filter(f => {
      const h = f.properties.style?.extrudeHeight ?? 0
      return h > 0 && f.geometry.type === 'Polygon'
    })

    const set = (id: string, feats: GeoJSON.Feature[]) => {
      const s = map.getSource(id) as mapboxgl.GeoJSONSource
      s?.setData({ type: 'FeatureCollection', features: feats })
    }
    set('ump-features', visible)
    set('ump-selected', selected)
    set('ump-extruded', extruded)
    set('ump-glow', visible.filter(f => f.geometry.type === 'Point'))
    set('ump-labels', visible)

    // Vertex handles for selected feature (select tool only)
    if ((activeTool === 'select' || activeTool === 'direct') && selectedIds.length === 1) {
      const selFeat = visible.find(f => f.properties.id === selectedIds[0])
      set('ump-vertices', selFeat ? extractVertexFeatures(selFeat) : [])
    } else {
      set('ump-vertices', [])
    }
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleLoadedRef.current) return
    syncFeaturesTo(map)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, selectedIds, layers, canvasSearchQuery, activeTool])

  // ── Map style ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapStyleInitialized.current) return
    const map = mapRef.current; if (!map) return
    styleLoadedRef.current = false
    map.setStyle(MAP_STYLES[mapStyle])
  }, [mapStyle])

  // ── 3D buildings ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map || !styleLoadedRef.current) return
    if (mode3D) {
      map.easeTo({ pitch: 45, duration: 600 })
      if (!map.getLayer('3d-buildings'))
        map.addLayer({ id: '3d-buildings', source: 'composite', 'source-layer': 'building', filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 14,
          paint: { 'fill-extrusion-color': '#aaa', 'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'height']], 'fill-extrusion-base': 0, 'fill-extrusion-opacity': 0.6 } })
    } else {
      map.easeTo({ pitch: 0, duration: 600 })
      if (map.getLayer('3d-buildings')) map.removeLayer('3d-buildings')
    }
  }, [mode3D])

  // ── Night glow ─────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map || !styleLoadedRef.current) return
    if (map.getLayer('ump-glow')) map.setPaintProperty('ump-glow', 'circle-opacity', nightMode ? 0.35 : 0)
  }, [nightMode])

  // ── Helpers ─────────────────────────────────────────────────────────────
  function updateMeasureSource(map: mapboxgl.Map, pts: [number, number][]) {
    const features: GeoJSON.Feature[] = pts.map(c => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties: {} }))
    if (pts.length > 1) features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts }, properties: {} })
    const src = map.getSource('ump-measure') as mapboxgl.GeoJSONSource
    src?.setData({ type: 'FeatureCollection', features })
  }

  function placeText() {
    if (!textPopup || !textInput.trim()) { setTextPopup(null); setTextInput(''); return }
    const feat = makeFeature(
      { type: 'Point', coordinates: textPopup.lngLat },
      'text', 'Annotations',
      { label: textInput.trim(), style: { ...activeStyle, textContent: textInput.trim() } as typeof activeStyle },
    )
    addFeature(feat); setTextPopup(null); setTextInput('')
  }

  function applyExtrude(height: number) {
    if (!selectedIds[0]) return
    const f = features.find(x => x.properties.id === selectedIds[0])
    if (!f) return
    // Store height in style properties
    const newStyle = { ...f.properties.style, extrudeHeight: height } as typeof f.properties.style
    const updated = { ...f, properties: { ...f.properties, style: newStyle } } as UMPFeature
    const { updateFeature } = useCanvasStore.getState()
    updateFeature(updated.properties.id, { style: updated.properties.style })
  }

  // Measure distances
  const measureDistances = measurePts.length > 1 ? measurePts.slice(1).map((p, i) => {
    const d = distFt(measurePts[i], p)
    const mid: [number, number] = [(measurePts[i][0] + p[0]) / 2, (measurePts[i][1] + p[1]) / 2]
    return { d, mid, screen: mapRef.current?.project(mid as [number, number]) }
  }) : []
  const totalDist = measurePts.length > 1 ? measurePts.slice(1).reduce((acc, p, i) => acc + distFt(measurePts[i], p), 0) : 0

  const token = (import.meta.env.VITE_MAPBOX_TOKEN ?? '').replace(/^﻿/, '').trim()
  const selectedPolygon = activeTool === 'extrude' && selectedIds.length === 1
    ? features.find(f => f.properties.id === selectedIds[0] && f.geometry.type === 'Polygon')
    : null

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {mapError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.85)', zIndex: 50 }}>
          <div style={{ background: '#1E293B', border: '1px solid #EF4444', borderRadius: 10, padding: '20px 28px', textAlign: 'center', color: '#fff', maxWidth: 340 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Map failed to load</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>{mapError}</div>
          </div>
        </div>
      )}

      {nightMode && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'rgba(10,15,35,0.52)', zIndex: 5 }} />}

      {/* ── Right-side controls ────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
        <MapGeocoder token={token} mapRef={mapRef} />
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--color-bg-panel)', borderRadius: 8, border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
          {(Object.keys(MAP_STYLES) as (keyof typeof MAP_STYLES)[]).map(k => <MapStyleBtn key={k} styleKey={k} active={mapStyle === k} onClick={() => setMapStyle(k)} />)}
          <div style={{ height: 1, background: 'var(--color-border)' }} />
          <button onClick={() => {
            const map = mapRef.current; if (!map) return
            setShowLabels(prev => { const n = !prev; map.getStyle()?.layers?.forEach(l => { if (l.type === 'symbol') map.setLayoutProperty(l.id, 'visibility', n ? 'visible' : 'none') }); return n })
          }}
            title={showLabels ? 'Hide labels' : 'Show labels'}
            style={{ width: 36, height: 32, border: 'none', cursor: 'pointer', background: showLabels ? 'transparent' : 'var(--color-accent-subtle)', color: showLabels ? 'var(--color-text-muted)' : 'var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h10M4 17h7"/></svg>
          </button>
        </div>
      </div>

      <MapOrientationControl />

      {/* Canvas search */}
      {showCanvasSearch && (
        <CanvasSearchBar query={canvasSearchQuery} onQuery={setCanvasSearchQuery} onClose={toggleCanvasSearch} features={features} onSelect={id => setSelectedIds([id])} />
      )}

      {/* Pen / draw tool tip */}
      {(activeTool === 'pen' || activeTool === 'line' || activeTool === 'rect' || activeTool === 'ellipse' || activeTool === 'polygon') && (
        <div style={{ position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 16, padding: '4px 14px', fontSize: 11, pointerEvents: 'none', zIndex: 10, backdropFilter: 'blur(6px)' }}>
          {activeTool === 'line' ? 'Click to add points · Double-click to finish' : 'Click to add points · Double-click to close shape · Esc to cancel'}
        </div>
      )}

      {/* Text popup */}
      {textPopup && (
        <div style={{ position: 'absolute', left: textPopup.x - 130, top: textPopup.y - 48, zIndex: 40, background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input autoFocus value={textInput} onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') placeText(); if (e.key === 'Escape') { setTextPopup(null); setTextInput('') } }}
            placeholder="Type text…" style={{ width: 180, height: 28, padding: '0 8px', fontSize: 13, border: '1px solid var(--color-border)', borderRadius: 5, background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none' }} />
          <button onClick={placeText} style={{ height: 28, padding: '0 10px', fontSize: 12, fontWeight: 600, borderRadius: 5, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer' }}>Place</button>
        </div>
      )}

      {/* Measure overlay */}
      {activeTool === 'measure' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 15 }}>
          {measureDistances.map((seg, i) => seg.screen && (
            <div key={i} style={{ position: 'absolute', left: seg.screen.x, top: seg.screen.y, transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.7)', color: '#F59E0B', borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {fmtDist(seg.d)}
            </div>
          ))}
          {measurePts.length > 1 && (
            <div style={{ position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', color: '#fff', borderRadius: 16, padding: '4px 16px', fontSize: 12, fontWeight: 600 }}>
              Total: {fmtDist(totalDist)} · Click to add points · Esc to clear
            </div>
          )}
          {measurePts.length === 0 && (
            <div style={{ position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 16, padding: '4px 16px', fontSize: 11, backdropFilter: 'blur(6px)' }}>
              Click points on the map to measure distance
            </div>
          )}
        </div>
      )}

      {/* Extrude panel */}
      {selectedPolygon && (
        <div style={{ position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)', zIndex: 20, background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: 10, padding: '12px 20px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 240 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)' }}>Extrude to 3D</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min={0} max={200} step={1} value={extrudeHeight}
              onChange={e => { const h = Number(e.target.value); setExtrudeHeight(h); applyExtrude(h) }}
              style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 50 }}>{extrudeHeight} m</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[10, 20, 30, 50, 100].map(h => (
              <button key={h} onClick={() => { setExtrudeHeight(h); applyExtrude(h) }} style={{ flex: 1, height: 24, fontSize: 10, fontWeight: 600, borderRadius: 4, border: '1px solid var(--color-border)', background: extrudeHeight === h ? 'var(--color-accent-subtle)' : 'transparent', color: extrudeHeight === h ? 'var(--color-accent)' : 'var(--color-text-muted)', cursor: 'pointer' }}>{h}m</button>
            ))}
          </div>
        </div>
      )}

      {/* Marquee box */}
      {marqueeBox && (
        <div style={{ position: 'absolute', left: marqueeBox.x, top: marqueeBox.y, width: marqueeBox.w, height: marqueeBox.h, border: '1.5px dashed #2563EB', background: 'rgba(37,99,235,0.08)', pointerEvents: 'none', zIndex: 20 }} />
      )}
    </div>
  )
}

// ── MapStyleBtn ──────────────────────────────────────────────────────────

function MapStyleBtn({ styleKey, active, onClick }: { styleKey: string; active: boolean; onClick: () => void }) {
  const icons: Record<string, React.ReactNode> = {
    satellite: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="4" y="4" width="7" height="7" rx="1" opacity="0.7"/><rect x="13" y="4" width="7" height="7" rx="1" opacity="0.4"/><rect x="4" y="13" width="7" height="7" rx="1" opacity="0.4"/><rect x="13" y="13" width="7" height="7" rx="1" opacity="0.7"/><line x1="4" y1="10" x2="20" y2="10"/><line x1="10" y1="4" x2="10" y2="20"/></svg>,
    streets:   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4" opacity="0.4"/><line x1="18.4" y1="5.6" x2="5.6" y2="18.4" opacity="0.4"/></svg>,
    light:     <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="7.05" y2="7.05"/><line x1="16.95" y1="16.95" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="16.95" y2="7.05"/><line x1="7.05" y1="16.95" x2="4.93" y2="19.07"/></svg>,
  }
  const labels: Record<string, string> = { satellite: 'Satellite', streets: 'Streets', light: 'Light' }
  return (
    <button onClick={onClick} title={labels[styleKey]}
      style={{ width: 36, height: 32, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'var(--color-accent-subtle)' : 'transparent', color: active ? 'var(--color-accent)' : 'var(--color-text-muted)', transition: 'all 100ms' }}>
      {icons[styleKey]}
    </button>
  )
}

// ── MapGeocoder ──────────────────────────────────────────────────────────

function MapGeocoder({ token, mapRef }: { token: string; mapRef: React.MutableRefObject<mapboxgl.Map | null> }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; place_name: string; center: [number, number] }>>([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=5&types=place,address,poi`)
        const d = await r.json()
        setResults(d.features ?? []); setOpen(true)
      } catch { setResults([]) }
    }, 350)
    return () => clearTimeout(t)
  }, [query, token])
  function flyTo(center: [number, number]) { mapRef.current?.flyTo({ center, zoom: 15, duration: 1200 }); setQuery(''); setResults([]); setOpen(false) }
  return (
    <div style={{ width: 260 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
        <svg style={{ position: 'absolute', left: 9, pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input value={query} onChange={e => { setQuery(e.target.value); if (!e.target.value) setOpen(false) }} onFocus={() => results.length > 0 && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Search location…"
          style={{ width: '100%', height: 34, padding: '0 28px 0 30px', fontSize: 12, border: 'none', background: 'transparent', color: 'var(--color-text)', outline: 'none', borderRadius: 8 }} />
        {query && <button onClick={() => { setQuery(''); setResults([]); setOpen(false) }} style={{ position: 'absolute', right: 6, width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14 }}>×</button>}
      </div>
      {open && results.length > 0 && (
        <div style={{ marginTop: 4, background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
          {results.map(r => (
            <div key={r.id} onMouseDown={() => flyTo(r.center)} style={{ padding: '8px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text)', borderBottom: '1px solid var(--color-border)', lineHeight: 1.3 }}
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

// ── CanvasSearchBar ──────────────────────────────────────────────────────

function CanvasSearchBar({ query, onQuery, onClose, features, onSelect }: { query: string; onQuery: (q: string) => void; onClose: () => void; features: UMPFeature[]; onSelect: (id: string) => void }) {
  const q = query.trim().toLowerCase()
  const results = q ? features.filter(f => f.properties.label.toLowerCase().includes(q)).slice(0, 8) : []
  return (
    <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: 'var(--color-bg-panel)', borderRadius: 10, border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', minWidth: 320 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, borderBottom: results.length ? '1px solid var(--color-border)' : 'none' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input autoFocus value={query} onChange={e => onQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') onClose() }} placeholder="Search features…"
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
      {q && results.length === 0 && <div style={{ padding: '10px 14px', fontSize: 12, color: 'var(--color-text-muted)' }}>No features found</div>}
    </div>
  )
}
