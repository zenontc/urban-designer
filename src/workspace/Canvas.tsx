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

const TOOL_TO_DRAW_MODE: Record<string, string> = {
  select:  'simple_select',
  direct:  'direct_select',
  pen:     'draw_polygon',
  line:    'draw_line_string',
  rect:    'draw_polygon',
  ellipse: 'draw_polygon',
  polygon: 'draw_polygon',
  hand:    'simple_select',
  zoom:    'simple_select',
}

const MAP_STYLES: Record<string, string> = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets:   'mapbox://styles/mapbox/streets-v12',
  light:     'mapbox://styles/mapbox/light-v11',
  dark:      'mapbox://styles/mapbox/dark-v11',
}

const DRAW_STYLES = [
  { id: 'gl-draw-polygon-fill', type: 'fill', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'fill-color': '#2563EB', 'fill-opacity': 0.12 } },
  { id: 'gl-draw-polygon-stroke', type: 'line', filter: ['all', ['==', '$type', 'Polygon'], ['!=', 'mode', 'static']], paint: { 'line-color': '#2563EB', 'line-width': 2, 'line-dasharray': [1] } },
  { id: 'gl-draw-line', type: 'line', filter: ['all', ['==', '$type', 'LineString'], ['!=', 'mode', 'static']], paint: { 'line-color': '#2563EB', 'line-width': 2 } },
  { id: 'gl-draw-point', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['!=', 'mode', 'static']], paint: { 'circle-radius': 5, 'circle-color': '#2563EB' } },
  { id: 'gl-draw-polygon-midpoint', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'midpoint']], paint: { 'circle-radius': 3, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#2563EB' } },
  { id: 'gl-draw-polygon-and-line-vertex', type: 'circle', filter: ['all', ['==', '$type', 'Point'], ['==', 'meta', 'vertex']], paint: { 'circle-radius': 5, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#2563EB' } },
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

  // Main fill layer
  map.addLayer({ id: 'ump-fill', type: 'fill', source: 'ump-features',
    filter: ['==', '$type', 'Polygon'],
    paint: { 'fill-color': ['coalesce', ['get', 'strokeColor', ['get', 'style']], '#2563EB'], 'fill-opacity': 0.2 } })

  // Main line layer
  map.addLayer({ id: 'ump-line', type: 'line', source: 'ump-features',
    paint: {
      'line-color': ['coalesce', ['get', 'strokeColor', ['get', 'style']], '#2563EB'],
      'line-width': ['coalesce', ['get', 'strokeWidth', ['get', 'style']], 2],
    } })

  // Main point layer
  map.addLayer({ id: 'ump-point', type: 'circle', source: 'ump-features',
    filter: ['==', '$type', 'Point'],
    paint: { 'circle-radius': 6, 'circle-color': ['coalesce', ['get', 'strokeColor', ['get', 'style']], '#2563EB'], 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })

  // Feature labels
  map.addLayer({ id: 'ump-labels', type: 'symbol', source: 'ump-labels',
    layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top' },
    paint: { 'text-color': '#fff', 'text-halo-color': 'rgba(0,0,0,0.6)', 'text-halo-width': 1.5 } })

  // Selection highlight layers
  map.addLayer({ id: 'ump-sel-fill', type: 'fill', source: 'ump-selected',
    filter: ['==', '$type', 'Polygon'],
    paint: { 'fill-color': '#F59E0B', 'fill-opacity': 0.25 } })
  map.addLayer({ id: 'ump-sel-line', type: 'line', source: 'ump-selected',
    paint: { 'line-color': '#F59E0B', 'line-width': 3, 'line-dasharray': [2, 1] } })
  map.addLayer({ id: 'ump-sel-point', type: 'circle', source: 'ump-selected',
    filter: ['==', '$type', 'Point'],
    paint: { 'circle-radius': 8, 'circle-color': '#F59E0B', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } })

  // Night glow layer (only visible in night mode)
  map.addLayer({ id: 'ump-glow', type: 'circle', source: 'ump-glow',
    paint: { 'circle-radius': 20, 'circle-color': '#FBBF24', 'circle-opacity': 0, 'circle-blur': 1 } })
}

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const drawRef = useRef<InstanceType<typeof MapboxDraw> | null>(null)
  const styleLoadedRef = useRef(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [mapDebug, setMapDebug] = useState<string>('initializing…')
  const { setMapInstance, setZoom, setCenter, setRotation, setPitch } = useMapStore()
  const { nightMode, mode3D, activeTool, activeStyle, activeElementType } = useUIStore()
  const { addFeature, updateGeometry, deleteFeatures, setSelectedIds, features, selectedIds } = useCanvasStore()
  const { layers } = useLayersStore()
  const { showCanvasSearch, canvasSearchQuery, setCanvasSearchQuery, toggleCanvasSearch } = useUIStore()
  const [mapStyle, setMapStyle] = useState<keyof typeof MAP_STYLES>('satellite')

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        toggleCanvasSearch()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleCanvasSearch])

  // ── Init ─────────────────────────────────────────────────────────────────
  const initMap = useCallback(() => {
    setMapDebug('initMap called')
    if (!containerRef.current || mapRef.current) { setMapDebug('container missing or already init'); return }
    // Strip BOM and whitespace that Notepad/Windows can add
    const rawToken = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
    const token = rawToken.replace(/^﻿/, '').trim()
    setMapDebug(`token: "${token.slice(0, 8)}…" (${token.length} chars)`)
    if (!token) {
      setMapError('Missing Mapbox token. Add VITE_MAPBOX_TOKEN to your .env file and restart npm run dev.')
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
      setMapInstance(map)
      setMapError(null)
      setMapDebug('loaded ✓')
    })

    map.on('error', (e) => {
      console.error('Mapbox error:', e)
      const msg = e.error?.message ?? 'unknown error'
      setMapDebug(`error: ${msg}`)
      if (msg.includes('access token') || msg.includes('401') || msg.includes('Unauthorized')) {
        setMapError('Invalid Mapbox token. Check your .env file.')
      } else {
        setMapError(`Map error: ${msg}`)
      }
    })

    map.on('style.load', () => {
      styleLoadedRef.current = true
      addFeatureLayers(map)
      // Re-sync features after style change
      syncFeatures(map)
    })

    // ── Click to select ────────────────────────────────────────────────────
    map.on('click', 'ump-fill', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (id) setSelectedIds([id])
      e.originalEvent.stopPropagation()
    })
    map.on('click', 'ump-line', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (id) setSelectedIds([id])
      e.originalEvent.stopPropagation()
    })
    map.on('click', 'ump-point', (e) => {
      const id = e.features?.[0]?.properties?.id as string | undefined
      if (id) setSelectedIds([id])
      e.originalEvent.stopPropagation()
    })
    // Click empty space → deselect
    map.on('click', () => setSelectedIds([]))

    // ── Hover cursors ──────────────────────────────────────────────────────
    for (const layer of ['ump-fill', 'ump-line', 'ump-point']) {
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
    }

    // ── Draw events ────────────────────────────────────────────────────────
    type DrawEvent = { features: GeoJSON.Feature[] }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapAny = map as any

    mapAny.on('draw.create', (e: DrawEvent) => {
      const [geom] = e.features
      if (!geom) return
      const feature = makeFeature(geom.geometry, activeElementType ?? 'generic', 'custom', { style: activeStyle })
      addFeature(feature)
      draw.delete(geom.id as string)
    })

    mapAny.on('draw.update', (e: DrawEvent) => {
      e.features.forEach(f => updateGeometry(f.id as string, f.geometry))
    })

    mapAny.on('draw.delete', (e: DrawEvent) => {
      deleteFeatures(e.features.map(f => f.id as string))
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
  }, [setMapInstance, setZoom, setCenter, setRotation, setPitch, addFeature, updateGeometry, deleteFeatures, setSelectedIds, activeStyle, activeElementType])

  useEffect(() => {
    initMap()
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; drawRef.current = null; setMapInstance(null) }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync draw mode ────────────────────────────────────────────────────────
  useEffect(() => {
    const draw = drawRef.current
    if (!draw) return
    const mode = TOOL_TO_DRAW_MODE[activeTool] ?? 'simple_select'
    try { draw.changeMode(mode) } catch { /* map not ready yet */ }
  }, [activeTool])

  // ── Sync features → map ───────────────────────────────────────────────────
  function syncFeatures(map: mapboxgl.Map) {
    const hiddenLayerIds = new Set(layers.filter(l => !l.visible).map(l => l.id))
    const visible = features.filter(f => !hiddenLayerIds.has(f.properties.layerGroup))
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

    // Labels for named features
    const labelFeats = visible.map(f => ({ ...f, properties: { ...f.properties, label: f.properties.label } }))
    setSrc('ump-labels', labelFeats)
  }

  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleLoadedRef.current) return
    syncFeatures(map)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features, selectedIds, layers, canvasSearchQuery])

  // ── Map style switcher ────────────────────────────────────────────────────
  useEffect(() => {
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
    map.setPaintProperty('ump-glow', 'circle-color', '#FBBF24')
  }, [nightMode])

  // ── Style switcher UI ─────────────────────────────────────────────────────
  const STYLE_OPTS: Array<{ key: keyof typeof MAP_STYLES; label: string }> = [
    { key: 'satellite', label: '🛰' },
    { key: 'streets',   label: '🗺' },
    { key: 'light',     label: '☀' },
    { key: 'dark',      label: '🌙' },
  ]

  return (
    <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Debug badge — remove before production */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 999, background: '#1E293B', color: '#fff', fontSize: 14, padding: '12px 20px', borderRadius: 8, fontFamily: 'monospace', pointerEvents: 'none', border: '2px solid #F59E0B', textAlign: 'center' }}>
        Map status: {mapDebug}
      </div>

      {mapError && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.85)', zIndex: 50 }}>
          <div style={{ background: '#1E293B', border: '1px solid #EF4444', borderRadius: 10, padding: '20px 28px', textAlign: 'center', color: '#fff', maxWidth: 340 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Map failed to load</div>
            <div style={{ fontSize: 12, color: '#94A3B8' }}>{mapError}</div>
          </div>
        </div>
      )}

      {/* Night mode overlay */}
      {nightMode && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'rgba(10,15,35,0.52)', zIndex: 5 }} />
      )}

      {/* Map style switcher */}
      <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--color-bg-panel)', borderRadius: 7, border: '1px solid var(--color-border)', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        {STYLE_OPTS.map(opt => (
          <button key={opt.key} onClick={() => setMapStyle(opt.key)} title={opt.key} style={{
            width: 32, height: 32, border: 'none', fontSize: 16, cursor: 'pointer',
            background: mapStyle === opt.key ? 'var(--color-accent-subtle)' : 'transparent',
            borderLeft: mapStyle === opt.key ? '2px solid var(--color-accent)' : '2px solid transparent',
          }}>
            {opt.label}
          </button>
        ))}
      </div>

      <MapOrientationControl />

      {/* Canvas search bar */}
      {showCanvasSearch && (
        <CanvasSearchBar
          query={canvasSearchQuery}
          onQuery={setCanvasSearchQuery}
          onClose={toggleCanvasSearch}
          features={features}
          onSelect={id => setSelectedIds([id])}
        />
      )}
    </div>
  )
}

function CanvasSearchBar({
  query,
  onQuery,
  onClose,
  features,
  onSelect,
}: {
  query: string
  onQuery: (q: string) => void
  onClose: () => void
  features: UMPFeature[]
  onSelect: (id: string) => void
}) {
  const q = query.trim().toLowerCase()
  const results = q ? features.filter(f => f.properties.label.toLowerCase().includes(q)).slice(0, 8) : []

  return (
    <div style={{
      position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
      zIndex: 30, display: 'flex', flexDirection: 'column', gap: 0,
      background: 'var(--color-bg-panel)', borderRadius: 10, border: '1px solid var(--color-border)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden', minWidth: 320,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', gap: 8, borderBottom: results.length ? '1px solid var(--color-border)' : 'none' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          autoFocus
          value={query}
          onChange={e => onQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') onClose() }}
          placeholder="Search features…"
          style={{ flex: 1, height: 40, border: 'none', background: 'transparent', fontSize: 13, color: 'var(--color-text)', outline: 'none' }}
        />
        {query && (
          <button onClick={() => onQuery('')} style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        )}
        <button onClick={onClose} style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
      </div>
      {results.map(f => (
        <div
          key={f.properties.id}
          onClick={() => { onSelect(f.properties.id); onClose() }}
          style={{ padding: '8px 14px', fontSize: 12, cursor: 'pointer', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--color-border)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
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
