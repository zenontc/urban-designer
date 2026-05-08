import React, { useEffect, useRef, useCallback, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { useMapStore } from '../store/mapStore'
import { useUIStore } from '../store/uiStore'
import { useCanvasStore, makeFeature } from '../store/canvasStore'
import type { UMPFeature } from '../store/canvasStore'
import { useLayersStore } from '../store/layersStore'
import { MapOrientationControl } from './components/MapOrientationControl'

const INITIAL_CENTER: [number, number] = [-87.6298, 41.8781]
const INITIAL_ZOOM = 15

// Which MapboxDraw mode each tool uses
const TOOL_TO_DRAW_MODE: Record<string, string> = {
  select:  'simple_select',
  direct:  'direct_select',
  pen:     'draw_polygon',
  line:    'draw_line_string',
  rect:    'draw_polygon',
  ellipse: 'draw_polygon',
  polygon: 'draw_polygon',
  text:    'simple_select',
  extrude: 'simple_select',
  measure: 'simple_select',
  addNode: 'direct_select',
  delNode: 'direct_select',
}

const MAP_STYLES: Record<string, string> = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets:   'mapbox://styles/mapbox/streets-v12',
  light:     'mapbox://styles/mapbox/light-v11',
}

const DRAW_STYLES = [
  { id: 'gl-draw-polygon-fill', type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.12 } },
  { id: 'gl-draw-polygon-stroke', type: 'line', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'line-color': '#2563EB', 'line-width': 2, 'line-dasharray': [1] } },
  { id: 'gl-draw-line', type: 'line', filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']], paint: { 'line-color': '#2563EB', 'line-width': 2 } },
  { id: 'gl-draw-point', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['!=', 'mode', 'static']], paint: { 'circle-radius': 5, 'circle-color': '#2563EB' } },
  { id: 'gl-draw-polygon-midpoint', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']], paint: { 'circle-radius': 4, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#2563EB' } },
  { id: 'gl-draw-polygon-and-line-vertex', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']], paint: { 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#2563EB' } },
  { id: 'gl-draw-polygon-fill-static', type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']], paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.12 } },
  { id: 'gl-draw-polygon-stroke-static', type: 'line', filter: ['all', ['==', '$type', 'Polygon'], ['==', 'mode', 'static']], paint: { 'line-color': '#2563EB', 'line-width': 2 } },
  { id: 'gl-draw-line-static', type: 'line', filter: ['all', ['==', '$type', 'LineString'], ['==', 'mode', 'static']], paint: { 'line-color': '#2563EB', 'line-width': 2 } },
  { id: 'gl-draw-point-static', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'mode', 'static']], paint: { 'circle-radius': 5, 'circle-color': '#2563EB' } },
]

function addFeatureLayers(map: mapboxgl.Map) {
  if (map.getSource('ump-features')) return

  map.addSource('ump-features', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource('ump-selected', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource('ump-glow', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource('ump-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })

  map.addLayer({ id: 'ump-fill', type: 'fill', source: 'ump-features',
    filter: ['==', '$type', 'Polygon'],
    paint: { 'fill-color': ['coalesce', ['get', 'fillColor', ['get', 'style']], '#2563EB'], 'fill-opacity': ['/', ['coalesce', ['get', 'fillOpacity', ['get', 'style']], 70], 100] } })

  map.addLayer({ id: 'ump-line', type: 'line', source: 'ump-features',
    paint: {
      'line-color': ['coalesce', ['get', 'strokeColor', ['get', 'style']], '#2563EB'],
      'line-width': ['coalesce', ['get', 'strokeWidth', ['get', 'style']], 2],
    } })

  map.addLayer({ id: 'ump-point', type: 'circle', source: 'ump-features',
    filter: ['==', '$type', 'Point'],
    paint: { 'circle-radius': 6, 'circle-color': ['coalesce', ['get', 'strokeColor', ['get', 'style']], '#2563EB'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })

  map.addLayer({ id: 'ump-labels', type: 'symbol', source: 'ump-labels',
    layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
    paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 1.5 } })

  // Text symbol layer for text-type features
  map.addLayer({ id: 'ump-text', type: 'symbol', source: 'ump-features',
    filter: ['==', ['get', 'elementType'], 'text'],
    layout: { 'text-field': ['coalesce', ['get', 'textContent', ['get', 'style']], ['get', 'label']], 'text-size': ['coalesce', ['get', 'fontSize', ['get', 'style']], 16], 'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'] },
    paint: { 'text-color': ['coalesce', ['get', 'strokeColor', ['get', 'style']], '#ffffff'], 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 2 } })

  map.addLayer({ id: 'ump-sel-fill', type: 'fill', source: 'ump-selected',
    filter: ['==', '$type', 'Polygon'],
    paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.25 } })
  map.addLayer({ id: 'ump-sel-line', type: 'line', source: 'ump-selected',
    paint: { 'line-color': '#F59E0B', 'line-width': 3, 'line-dasharray': [2, 1] } })
  map.addLayer({ id: 'ump-sel-point', type: 'circle', source: 'ump-selected',
    filter: ['==', '$type', 'Point'],
    paint: { 'circle-radius': 8, 'circle-color': '#F59E0B', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })

  map.addLayer({ id: 'ump-glow', type: 'circle', source: 'ump-glow',
    paint: { 'circle-radius': 20, 'circle-color': '#FBBF24', 'circle-opacity': 0, 'circle-blur': 1 } })
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
  // Track the feature currently loaded into MapboxDraw for node editing
  const editingRef = useRef<{ drawId: string; featureId: string } | null>(null)

  const [mapError, setMapError] = useState<string | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [mapStyle, setMapStyle] = useState<keyof typeof MAP_STYLES>('satellite')
  const [editingFeatureId, setEditingFeatureId] = useState<string | null>(null)
  // Text placement popup
  const [textPopup, setTextPopup] = useState<{ x: number; y: number; lngLat: [number, number] } | null>(null)
  const [textInput, setTextInput] = useState('')

  const { setMapInstance, setZoom, setCenter, setRotation, setPitch } = useMapStore()
  const { nightMode, mode3D, activeTool, activeStyle, activeElementType } = useUIStore()
  const { addFeature, updateGeometry, deleteFeatures, setSelectedIds, features, selectedIds } = useCanvasStore()
  const { layers } = useLayersStore()
  const { showCanvasSearch, canvasSearchQuery, setCanvasSearchQuery, toggleCanvasSearch } = useUIStore()

  // Keep refs in sync so event handlers can read current values
  useEffect(() => { activeToolRef.current = activeTool }, [activeTool])
  useEffect(() => { featuresRef.current = features }, [features])
  useEffect(() => { activeStyleRef.current = activeStyle }, [activeStyle])
  useEffect(() => { activeElementTypeRef.current = activeElementType }, [activeElementType])

  // Cmd+F shortcut
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
    const rawToken = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
    const token = rawToken.replace(/^﻿/, '').trim()
    if (!token) {
      setMapError('Missing Mapbox token. Add VITE_MAPBOX_TOKEN to your .env file and restart.')
      return
    }
    mapboxgl.accessToken = token

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES.satellite,
      center: INITIAL_CENTER,
      zoom: INITIAL_ZOOM,
      antialias: true,
      fadeDuration: 0,
      preserveDrawingBuffer: true,
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
      const msg = e.error?.message ?? 'unknown error'
      if (msg.includes('access token') || msg.includes('401') || msg.includes('Unauthorized')) {
        setMapError('Invalid Mapbox token. Check your .env file.')
      }
    })

    map.on('style.load', () => {
      styleLoadedRef.current = true
      addFeatureLayers(map)
      syncFeatures(map)
    })

    // ── Click handlers ─────────────────────────────────────────────────────
    function handleFeatureClick(id: string, e: mapboxgl.MapMouseEvent) {
      const tool = activeToolRef.current
      setSelectedIds([id])

      // In select/direct mode: load feature into MapboxDraw for node editing
      if (tool === 'select' || tool === 'direct') {
        const feature = featuresRef.current.find(f => f.properties.id === id)
        if (feature) {
          // Clear previous editing session
          if (editingRef.current) {
            draw.delete(editingRef.current.drawId)
            editingRef.current = null
            setEditingFeatureId(null)
          }
          // Load into MapboxDraw
          const ids = draw.add(feature as GeoJSON.Feature)
          const drawId = ids[0]
          editingRef.current = { drawId, featureId: id }
          setEditingFeatureId(id)
          try { draw.changeMode('direct_select', { featureId: drawId }) } catch { /* ignore */ }
        }
      }

      e.originalEvent.stopPropagation()
    }

    map.on('click', 'ump-fill', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (id) handleFeatureClick(id, e)
    })
    map.on('click', 'ump-line', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (id) handleFeatureClick(id, e)
    })
    map.on('click', 'ump-point', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (id) handleFeatureClick(id, e)
    })

    // Background click: place text, deselect, or clear editing
    map.on('click', (e) => {
      const tool = activeToolRef.current

      if (tool === 'text') {
        const rect = containerRef.current?.getBoundingClientRect()
        setTextPopup({
          x: e.point.x + (rect?.left ?? 0),
          y: e.point.y + (rect?.top ?? 0),
          lngLat: [e.lngLat.lng, e.lngLat.lat],
        })
        return
      }

      // Clear editing
      if (editingRef.current) {
        const { drawId, featureId } = editingRef.current
        const edited = draw.get(drawId)
        if (edited?.geometry) updateGeometry(featureId, edited.geometry as GeoJSON.Geometry)
        draw.delete(drawId)
        editingRef.current = null
        setEditingFeatureId(null)
        try { draw.changeMode('simple_select') } catch { /* ignore */ }
      }
      setSelectedIds([])
    })

    // ── Hover cursors ──────────────────────────────────────────────────────
    for (const layer of ['ump-fill', 'ump-line', 'ump-point']) {
      map.on('mouseenter', layer, () => {
        const tool = activeToolRef.current
        if (tool === 'select' || tool === 'direct') map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', layer, () => {
        const tool = activeToolRef.current
        if (tool === 'select' || tool === 'direct') map.getCanvas().style.cursor = ''
      })
    }

    // ── Draw events ────────────────────────────────────────────────────────
    type DrawEvent = { features: GeoJSON.Feature[] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapAny = map as any

    mapAny.on('draw.create', (e: DrawEvent) => {
      const [geom] = e.features
      if (!geom) return
      // Only process if this is a freshly-drawn feature (not one we loaded for editing)
      if (editingRef.current && e.features.some(f => f.id === editingRef.current?.drawId)) return
      const feature = makeFeature(
        geom.geometry,
        activeElementTypeRef.current ?? 'generic',
        'custom',
        { style: activeStyleRef.current },
      )
      addFeature(feature)
      draw.delete(geom.id as string)
    })

    mapAny.on('draw.update', (e: DrawEvent) => {
      if (editingRef.current) {
        const { drawId, featureId } = editingRef.current
        const updated = e.features.find(f => f.id === drawId)
        if (updated?.geometry) updateGeometry(featureId, updated.geometry as GeoJSON.Geometry)
      }
    })

    mapAny.on('draw.delete', (e: DrawEvent) => {
      if (!editingRef.current) {
        deleteFeatures(e.features.map(f => f.id as string))
      }
    })

    map.on('move', () => {
      const c = map.getCenter()
      setCenter([c.lng, c.lat])
      setZoom(map.getZoom())
      setRotation(map.getBearing())
      setPitch(map.getPitch())
    })

    mapRef.current = map
    drawRef.current = draw
  }, [setMapInstance, setZoom, setCenter, setRotation, setPitch, addFeature, updateGeometry, deleteFeatures, setSelectedIds])

  useEffect(() => {
    initMap()
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; drawRef.current = null; setMapInstance(null) }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tool switching ─────────────────────────────────────────────────────────
  useEffect(() => {
    const draw = drawRef.current
    const map = mapRef.current
    if (!draw || !map) return

    // Save any in-progress node editing when switching tools
    if (editingRef.current && activeTool !== 'select' && activeTool !== 'direct') {
      const { drawId, featureId } = editingRef.current
      const edited = draw.get(drawId)
      if (edited?.geometry) updateGeometry(featureId, edited.geometry as GeoJSON.Geometry)
      draw.delete(drawId)
      editingRef.current = null
      setEditingFeatureId(null)
    }

    // Update cursor
    const canvas = map.getCanvas()
    if (activeTool === 'text') canvas.style.cursor = 'crosshair'
    else canvas.style.cursor = ''

    const mode = TOOL_TO_DRAW_MODE[activeTool] ?? 'simple_select'
    try { draw.changeMode(mode) } catch { /* map not ready */ }
  }, [activeTool, updateGeometry])

  // ── Sync features → map ───────────────────────────────────────────────────
  function syncFeatures(map: mapboxgl.Map) {
    const hiddenLayerIds = new Set(layers.filter(l => !l.visible).map(l => l.id))
    // Hide features being edited in MapboxDraw (they're shown by Draw's own rendering)
    const edId = editingRef.current?.featureId
    const visible = features.filter(f => !hiddenLayerIds.has(f.properties.layerGroup) && f.properties.id !== edId)
    const q = canvasSearchQuery.trim().toLowerCase()
    const searchHits = q ? visible.filter(f => f.properties.label.toLowerCase().includes(q)) : []
    const selected = visible.filter(f => selectedIds.includes(f.properties.id) || (q && searchHits.some(h => h.properties.id === f.properties.id)))
    const emitters = visible.filter(f => f.geometry.type === 'Point')

    const setSrc = (id: string, feats: typeof features) => {
      const src = map.getSource(id) as mapboxgl.GeoJSONSource | undefined
      src?.setData({ type: 'FeatureCollection', features: feats })
    }
    setSrc('ump-features', visible)
    setSrc('ump-selected', selected)
    setSrc('ump-glow', emitters)
    setSrc('ump-labels', visible.map(f => ({ ...f, properties: { ...f.properties, label: f.properties.label } })))
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleLoadedRef.current) return
    syncFeatures(map)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, selectedIds, layers, canvasSearchQuery, editingFeatureId])

  // ── Map style switcher ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapStyleInitialized.current) return
    const map = mapRef.current
    if (!map) return
    styleLoadedRef.current = false
    map.setStyle(MAP_STYLES[mapStyle])
  }, [mapStyle])

  // ── 3D buildings ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleLoadedRef.current) return
    if (mode3D) {
      map.easeTo({ pitch: 45, duration: 600 })
      if (!map.getLayer('3d-buildings')) {
        map.addLayer({ id: '3d-buildings', source: 'composite', 'source-layer': 'building', filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 14,
          paint: { 'fill-extrusion-color': '#aaa', 'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'height']], 'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'min_height']], 'fill-extrusion-opacity': 0.6 } })
      }
    } else {
      map.easeTo({ pitch: 0, duration: 600 })
      if (map.getLayer('3d-buildings')) map.removeLayer('3d-buildings')
    }
  }, [mode3D])

  // ── Night mode glow ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleLoadedRef.current) return
    const layer = map.getLayer('ump-glow')
    if (!layer) return
    map.setPaintProperty('ump-glow', 'circle-opacity', nightMode ? 0.35 : 0)
  }, [nightMode])

  // ── Place text feature ─────────────────────────────────────────────────────
  function placeText() {
    if (!textPopup || !textInput.trim()) { setTextPopup(null); setTextInput(''); return }
    const feature = makeFeature(
      { type: 'Point', coordinates: textPopup.lngLat },
      'text', 'Annotations',
      { label: textInput.trim(), style: { ...activeStyle, textContent: textInput.trim() } as typeof activeStyle },
    )
    addFeature(feature)
    setTextPopup(null)
    setTextInput('')
  }

  const token = (import.meta.env.VITE_MAPBOX_TOKEN ?? '').replace(/^﻿/, '').trim()

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

      {nightMode && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'rgba(10,15,35,0.52)', zIndex: 5 }} />
      )}

      {/* ── Right-side map controls ────────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>

        {/* Location search */}
        <MapGeocoder token={token} mapRef={mapRef} />

        {/* Map style + label toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, background: 'var(--color-bg-panel)', borderRadius: 8, border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
          {(Object.keys(MAP_STYLES) as Array<keyof typeof MAP_STYLES>).map(key => (
            <MapStyleButton key={key} styleKey={key} active={mapStyle === key} onClick={() => setMapStyle(key)} />
          ))}
          <div style={{ height: 1, background: 'var(--color-border)' }} />
          {/* Labels toggle */}
          <button
            onClick={() => {
              const map = mapRef.current; if (!map) return
              setShowLabels(prev => {
                const next = !prev
                map.getStyle()?.layers?.forEach(l => {
                  if (l.type === 'symbol') map.setLayoutProperty(l.id, 'visibility', next ? 'visible' : 'none')
                })
                return next
              })
            }}
            title={showLabels ? 'Hide labels' : 'Show labels'}
            style={{
              width: 36, height: 32, border: 'none', cursor: 'pointer',
              background: showLabels ? 'transparent' : 'var(--color-accent-subtle)',
              color: showLabels ? 'var(--color-text-muted)' : 'var(--color-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h10M4 17h7" />
            </svg>
          </button>
        </div>
      </div>

      <MapOrientationControl />

      {/* Canvas feature search */}
      {showCanvasSearch && (
        <CanvasSearchBar
          query={canvasSearchQuery}
          onQuery={setCanvasSearchQuery}
          onClose={toggleCanvasSearch}
          features={features}
          onSelect={id => setSelectedIds([id])}
        />
      )}

      {/* Text placement popup */}
      {textPopup && (
        <div style={{
          position: 'absolute',
          left: textPopup.x - 130,
          top: textPopup.y - 44,
          zIndex: 40,
          background: 'var(--color-bg-panel)',
          border: '1px solid var(--color-border)',
          borderRadius: 8, padding: '10px 12px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex', gap: 6, alignItems: 'center',
        }}>
          <input
            autoFocus
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') placeText(); if (e.key === 'Escape') { setTextPopup(null); setTextInput('') } }}
            placeholder="Type text…"
            style={{ width: 180, height: 28, padding: '0 8px', fontSize: 13, border: '1px solid var(--color-border)', borderRadius: 5, background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none' }}
          />
          <button onClick={placeText} style={{ height: 28, padding: '0 10px', fontSize: 12, fontWeight: 600, borderRadius: 5, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer' }}>
            Place
          </button>
        </div>
      )}
    </div>
  )
}

// ── Map style icons ────────────────────────────────────────────────────────

function MapStyleButton({ styleKey, active, onClick }: {
  styleKey: keyof typeof MAP_STYLES; active: boolean; onClick: () => void
}) {
  const icons: Record<string, React.ReactNode> = {
    satellite: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <rect x="4" y="4" width="7" height="7" rx="1" opacity="0.6" />
        <rect x="13" y="4" width="7" height="7" rx="1" opacity="0.4" />
        <rect x="4" y="13" width="7" height="7" rx="1" opacity="0.4" />
        <rect x="13" y="13" width="7" height="7" rx="1" opacity="0.6" />
        <line x1="4" y1="10" x2="20" y2="10" />
        <line x1="10" y1="4" x2="10" y2="20" />
      </svg>
    ),
    streets: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <line x1="12" y1="3" x2="12" y2="21" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="5" y1="5" x2="19" y2="19" opacity="0.4" />
        <line x1="19" y1="5" x2="5" y2="19" opacity="0.4" />
      </svg>
    ),
    light: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="4" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="4.93" x2="7.05" y2="7.05" />
        <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
        <line x1="19.07" y1="4.93" x2="16.95" y2="7.05" />
        <line x1="7.05" y1="16.95" x2="4.93" y2="19.07" />
      </svg>
    ),
  }

  const labels: Record<string, string> = { satellite: 'Satellite', streets: 'Streets', light: 'Light' }

  return (
    <button
      onClick={onClick}
      title={labels[styleKey]}
      style={{
        width: 36, height: 32, border: 'none', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: active ? 'var(--color-accent-subtle)' : 'transparent',
        color: active ? 'var(--color-accent)' : 'var(--color-text-muted)',
        transition: 'all 100ms',
      }}
    >
      {icons[styleKey]}
    </button>
  )
}

// ── Location geocoder ──────────────────────────────────────────────────────

function MapGeocoder({ token, mapRef }: { token: string; mapRef: React.MutableRefObject<mapboxgl.Map | null> }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; place_name: string; center: [number, number] }>>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (query.length < 2) { setResults([]); return }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=5&types=place,address,poi`)
        const data = await res.json()
        setResults(data.features ?? [])
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
        <svg style={{ position: 'absolute', left: 9, pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); if (!e.target.value) setOpen(false) }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search location…"
          style={{ width: '100%', height: 34, padding: '0 28px 0 30px', fontSize: 12, border: 'none', background: 'transparent', color: 'var(--color-text)', outline: 'none', borderRadius: 8 }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false) }} style={{ position: 'absolute', right: 6, width: 18, height: 18, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        )}
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

// ── Canvas search bar ──────────────────────────────────────────────────────

function CanvasSearchBar({ query, onQuery, onClose, features, onSelect }: {
  query: string; onQuery: (q: string) => void; onClose: () => void
  features: UMPFeature[]; onSelect: (id: string) => void
}) {
  const q = query.trim().toLowerCase()
  const results = q ? features.filter(f => f.properties.label.toLowerCase().includes(q)).slice(0, 8) : []
  return (
    <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 30, background: 'var(--color-bg-panel)', borderRadius: 10, border: '1px solid var(--color-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', minWidth: 320 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, borderBottom: results.length ? '1px solid var(--color-border)' : 'none' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input autoFocus value={query} onChange={e => onQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') onClose() }} placeholder="Search features…"
          style={{ flex: 1, height: 40, border: 'none', background: 'transparent', fontSize: 13, color: 'var(--color-text)', outline: 'none' }} />
        <button onClick={onClose} style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
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
