import React, { useEffect, useState } from 'react'
import type mapboxgl from 'mapbox-gl'
import { useCanvasStore, makeFeature } from '../store/canvasStore'
import { useMapStore } from '../store/mapStore'
import type { UMPFeature } from '../store/canvasStore'

function isGeoJSONFeatureCollection(data: unknown): data is GeoJSON.FeatureCollection {
  return typeof data === 'object' && data !== null && (data as Record<string,unknown>).type === 'FeatureCollection'
}
function isGeoJSONFeature(data: unknown): data is GeoJSON.Feature {
  return typeof data === 'object' && data !== null && (data as Record<string,unknown>).type === 'Feature'
}

async function parseFile(file: File): Promise<UMPFeature[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.geojson') || name.endsWith('.json')) {
    const data = JSON.parse(await file.text())
    if (isGeoJSONFeatureCollection(data)) {
      return data.features
        .filter((f): f is GeoJSON.Feature => isGeoJSONFeature(f) && !!f.geometry)
        .map(f => makeFeature(f.geometry, (f.properties?.elementType as string) ?? 'imported', (f.properties?.category as string) ?? 'Import', { label: (f.properties?.label as string) ?? (f.properties?.name as string) ?? 'Imported feature' }))
    }
    if (isGeoJSONFeature(data) && data.geometry) return [makeFeature(data.geometry, 'imported', 'Import')]
    throw new Error('Not a valid GeoJSON file')
  }
  if (name.endsWith('.shp')) {
    const { default: shp } = await import('shpjs')
    const result = await shp(await file.arrayBuffer())
    const fc = Array.isArray(result) ? result[0] : result
    if (!fc || !isGeoJSONFeatureCollection(fc)) throw new Error('Could not parse shapefile')
    return fc.features
      .filter((f): f is GeoJSON.Feature => isGeoJSONFeature(f) && !!f.geometry)
      .map(f => makeFeature(f.geometry, 'imported', 'Import', { label: (f.properties?.NAME as string) ?? 'Shape' }))
  }
  if (name.endsWith('.kml') || name.endsWith('.kmz')) {
    const doc = new DOMParser().parseFromString(await file.text(), 'text/xml')
    return Array.from(doc.querySelectorAll('Placemark')).flatMap(pm => {
      const label = pm.querySelector('name')?.textContent ?? 'KML feature'
      const point = pm.querySelector('Point coordinates')
      if (point) { const [lng, lat] = point.textContent!.trim().split(',').map(Number); return [makeFeature({ type: 'Point', coordinates: [lng, lat] }, 'imported', 'Import', { label })] }
      const lineCoords = pm.querySelector('LineString coordinates')
      if (lineCoords) { const coords = lineCoords.textContent!.trim().split(/\s+/).map(s => s.split(',').map(Number).slice(0, 2)); return [makeFeature({ type: 'LineString', coordinates: coords }, 'imported', 'Import', { label })] }
      const polyCoords = pm.querySelector('Polygon outerBoundaryIs coordinates')
      if (polyCoords) { const coords = polyCoords.textContent!.trim().split(/\s+/).map(s => s.split(',').map(Number).slice(0, 2)); return [makeFeature({ type: 'Polygon', coordinates: [coords] }, 'imported', 'Import', { label })] }
      return []
    })
  }
  throw new Error(`Unsupported format: ${name}`)
}

function fitToFeatures(mapInstance: mapboxgl.Map, features: UMPFeature[]) {
  const allCoords: number[][] = []
  features.forEach(f => {
    const geom = f.geometry
    if (geom.type === 'Point') allCoords.push(geom.coordinates as number[])
    else if (geom.type === 'LineString') allCoords.push(...geom.coordinates)
    else if (geom.type === 'Polygon') allCoords.push(...geom.coordinates[0])
  })
  if (allCoords.length === 0) return
  const lngs = allCoords.map(c => c[0])
  const lats = allCoords.map(c => c[1])
  mapInstance.fitBounds(
    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
    { padding: 60, maxZoom: 18, duration: 600 },
  )
}

export function ImportZone() {
  const { addFeature } = useCanvasStore()
  const { mapInstance } = useMapStore()
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    let dragCounter = 0

    async function onDrop(e: DragEvent) {
      e.preventDefault()
      dragCounter = 0
      setDragging(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length === 0) return
      const importedAll: UMPFeature[] = []
      for (const file of files) {
        try {
          setStatus(`Importing ${file.name}…`)
          const features = await parseFile(file)
          features.forEach(f => addFeature(f))
          importedAll.push(...features)
          setStatus(`Imported ${features.length} features from ${file.name}`)
        } catch (err) {
          setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
      }
      if (importedAll.length > 0 && mapInstance) fitToFeatures(mapInstance, importedAll)
      setTimeout(() => setStatus(null), 4000)
    }

    function onDragEnter(e: DragEvent) {
      if (!e.dataTransfer?.types.includes('Files')) return
      dragCounter++
      setDragging(true)
    }

    function onDragLeave() {
      dragCounter--
      if (dragCounter <= 0) { dragCounter = 0; setDragging(false) }
    }

    function onDragOver(e: DragEvent) { e.preventDefault() }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [addFeature, mapInstance])

  return (
    <>
      {/* Drop overlay — only renders when dragging, never blocks map interaction */}
      {dragging && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 51,
          background: 'rgba(37,99,235,0.08)',
          border: '3px dashed var(--color-accent)',
          borderRadius: 4, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: 'var(--color-bg-panel)', borderRadius: 12, padding: '20px 32px', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-accent)' }}>Drop to Import</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>GeoJSON · SHP · KML/KMZ</div>
          </div>
        </div>
      )}

      {status && !dragging && (
        <div style={{
          position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)',
          borderRadius: 8, padding: '8px 16px', fontSize: 12, color: 'var(--color-text)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 20, whiteSpace: 'nowrap',
        }}>
          {status}
        </div>
      )}
    </>
  )
}
