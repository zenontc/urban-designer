import React, { useState, useRef, useEffect } from 'react'
import { Icon } from './components/Icon'
import { Tooltip } from './components/Tooltip'
import { useUIStore } from '../store/uiStore'
import { useProjectStore } from '../store/projectStore'
import { useCanvasStore, makeFeature } from '../store/canvasStore'
import { exportGeoJSON, exportKMZ, exportPNG, exportPDF, exportSHP } from '../utils/exportUtils'
import type { UMPFeature } from '../store/canvasStore'

interface TopBarProps {
  onNavigate: (page: string) => void
  onAction?: (action: string) => void
}

function isGeoJSONFeatureCollection(data: unknown): data is GeoJSON.FeatureCollection {
  return typeof data === 'object' && data !== null && (data as Record<string, unknown>).type === 'FeatureCollection'
}
function isGeoJSONFeature(data: unknown): data is GeoJSON.Feature {
  return typeof data === 'object' && data !== null && (data as Record<string, unknown>).type === 'Feature'
}

export function TopBar({ onNavigate, onAction }: TopBarProps) {
  const { nightMode, setNightMode, mode3D, setMode3D, toggleShadowPanel, toggleShareModal, units, setUnits } = useUIStore()
  const { projectName, setProjectName, saveState, isGuest } = useProjectStore()
  const { features, addFeature, undo, redo, canUndo, canRedo } = useCanvasStore()
  const [editingName, setEditingName] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  // Undo/redo keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo(); else undo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])
  const [tmpName, setTmpName] = useState(projectName)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  async function handleImportFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    for (const file of Array.from(files)) {
      try {
        const parsed = await parseImportFile(file)
        parsed.forEach(f => addFeature(f))
      } catch (err) {
        console.error('Import error:', err)
      }
    }
  }

  async function parseImportFile(file: File): Promise<UMPFeature[]> {
    const name = file.name.toLowerCase()
    if (name.endsWith('.geojson') || name.endsWith('.json')) {
      const data = JSON.parse(await file.text())
      if (isGeoJSONFeatureCollection(data)) {
        return data.features
          .filter((f): f is GeoJSON.Feature => isGeoJSONFeature(f) && !!f.geometry)
          .map(f => makeFeature(f.geometry, (f.properties?.elementType as string) ?? 'imported', (f.properties?.category as string) ?? 'Import', { label: (f.properties?.label as string) ?? 'Imported feature' }))
      }
      if (isGeoJSONFeature(data) && data.geometry) {
        return [makeFeature(data.geometry, 'imported', 'Import')]
      }
    }
    if (name.endsWith('.shp')) {
      const { default: shp } = await import('shpjs')
      const result = await shp(await file.arrayBuffer())
      const fc = Array.isArray(result) ? result[0] : result
      if (fc && isGeoJSONFeatureCollection(fc)) {
        return fc.features
          .filter((f): f is GeoJSON.Feature => isGeoJSONFeature(f) && !!f.geometry)
          .map(f => makeFeature(f.geometry, 'imported', 'Import', { label: (f.properties?.NAME as string) ?? 'Shape' }))
      }
    }
    if (name.endsWith('.kml') || name.endsWith('.kmz')) {
      const text = await file.text()
      const doc = new DOMParser().parseFromString(text, 'text/xml')
      const placemarks = Array.from(doc.querySelectorAll('Placemark'))
      return placemarks.flatMap(pm => {
        const label = pm.querySelector('name')?.textContent ?? 'KML feature'
        const point = pm.querySelector('Point coordinates')
        if (point) {
          const [lng, lat] = point.textContent!.trim().split(',').map(Number)
          return [makeFeature({ type: 'Point', coordinates: [lng, lat] }, 'imported', 'Import', { label })]
        }
        const lineCoords = pm.querySelector('LineString coordinates')
        if (lineCoords) {
          const coords = lineCoords.textContent!.trim().split(/\s+/).map(s => s.split(',').map(Number).slice(0, 2))
          return [makeFeature({ type: 'LineString', coordinates: coords }, 'imported', 'Import', { label })]
        }
        const polyCoords = pm.querySelector('Polygon outerBoundaryIs coordinates')
        if (polyCoords) {
          const coords = polyCoords.textContent!.trim().split(/\s+/).map(s => s.split(',').map(Number).slice(0, 2))
          return [makeFeature({ type: 'Polygon', coordinates: [coords] }, 'imported', 'Import', { label })]
        }
        return []
      })
    }
    return []
  }

  function handleFileAction(label: string) {
    setFileMenuOpen(false)
    if (label === 'Import…') { importInputRef.current?.click(); return }
    if (label === 'Export GeoJSON') exportGeoJSON(features, `${projectName}.geojson`)
    if (label === 'Export KMZ') exportKMZ(features, projectName)
    if (label === 'Export PNG…') {
      const el = document.querySelector('.mapboxgl-canvas') as HTMLElement | null
      if (el) exportPNG(el, `${projectName}.png`)
    }
    if (label === 'Export PDF…') {
      const el = document.querySelector('.mapboxgl-canvas') as HTMLElement | null
      if (el) exportPDF(el, projectName)
    }
    if (label === 'Export SHP (CSV)') exportSHP(features, projectName)
    if (label === 'Print Layout…' || label === 'Scenario…') onAction?.(label)
  }

  const saveMap = { saved: '✓ Saved', saving: 'Saving…', unsaved: '● Unsaved' }
  const saveColor = { saved: 'var(--color-success)', saving: 'var(--color-text-muted)', unsaved: 'var(--color-warning)' }

  const s = {
    bar: { height: 52, background: 'var(--color-bg-panel)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', paddingLeft: 12, paddingRight: 12, gap: 8, zIndex: 100, position: 'relative' as const, flexShrink: 0 },
    logoMark: { width: 36, height: 36, background: '#A3B57A', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14, letterSpacing: '0.02em', fontFamily: "'Inter Tight', sans-serif", cursor: 'pointer' },
    divider: { width: 1, height: 24, background: 'var(--color-border)', margin: '0 4px' },
    projectName: { fontSize: 14, fontWeight: 500, color: 'var(--color-text)', padding: '3px 6px', borderRadius: 4, border: '1.5px solid transparent', cursor: 'pointer', minWidth: 120, maxWidth: 240, background: 'transparent', outline: 'none' },
    menuBtn: { height: 28, padding: '0 10px', fontSize: 12, fontWeight: 500, borderRadius: 5, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-sec)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 },
    iconBtn: { width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-sec)' },
    pillBtn: (active: boolean, color: string) => ({ height: 28, padding: '0 10px', fontSize: 12, fontWeight: 500, borderRadius: 5, border: `1px solid ${active ? color : 'var(--color-border)'}`, background: active ? `${color}18` : 'transparent', color: active ? color : 'var(--color-text-sec)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }),
    shareBtn: { height: 30, padding: '0 14px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
    unitToggle: { display: 'flex', border: '1px solid var(--color-border)', borderRadius: 5, overflow: 'hidden' },
    unitBtn: (active: boolean) => ({ padding: '3px 8px', fontSize: 11, fontWeight: active ? 600 : 400, background: active ? 'var(--color-accent)' : 'transparent', color: active ? '#fff' : 'var(--color-text-sec)', border: 'none', cursor: 'pointer' }),
    fileMenu: { position: 'absolute' as const, top: 'calc(100% + 4px)', left: 0, background: 'var(--color-bg-panel)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 8px 32px rgba(15,23,42,0.12)', zIndex: 999, minWidth: 180, padding: '4px 0' },
    fileItem: { padding: '7px 14px', fontSize: 13, color: 'var(--color-text)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 },
    fileDivider: { height: 1, background: 'var(--color-border)', margin: '3px 0' },
    avatar: { width: 30, height: 30, borderRadius: '50%', background: '#DDD6FE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#5B21B6', cursor: 'pointer', border: '1.5px solid var(--color-border)' },
  }

  const fileItems: Array<[string, string] | null> = [
    ['file', 'New'], ['copy', 'Duplicate'], ['upload', 'Import…'], null,
    ['download', 'Export PNG…'], ['download', 'Export PDF…'], ['download', 'Export GeoJSON'],
    ['download', 'Export KMZ'], ['download', 'Export SHP (CSV)'], null,
    ['file', 'Print Layout…'], ['layers', 'Scenario…'],
  ]

  return (
    <div style={s.bar}>
      {/* Hidden file input for import */}
      <input
        ref={importInputRef}
        type="file"
        accept=".geojson,.json,.shp,.kml,.kmz"
        multiple
        style={{ display: 'none' }}
        onChange={e => handleImportFiles(e.target.files)}
      />
      <div style={s.logoMark} onClick={() => onNavigate('dashboard')}>UD</div>
      <div style={s.divider} />

      {editingName ? (
        <input
          ref={nameRef} value={tmpName}
          onChange={e => setTmpName(e.target.value)}
          onBlur={() => { setProjectName(tmpName); setEditingName(false) }}
          onKeyDown={e => {
            if (e.key === 'Enter') { setProjectName(tmpName); setEditingName(false) }
            if (e.key === 'Escape') { setTmpName(projectName); setEditingName(false) }
          }}
          style={{ ...s.projectName, border: '1.5px solid var(--color-accent)', background: 'var(--color-accent-subtle)', outline: 'none' }}
          autoFocus
        />
      ) : (
        <div style={s.projectName} onDoubleClick={() => { setTmpName(projectName); setEditingName(true) }}>{projectName}</div>
      )}

      {/* File menu */}
      <div style={{ position: 'relative' }}>
        <button style={s.menuBtn} onClick={() => setFileMenuOpen(!fileMenuOpen)}>
          File <Icon name="chevronDown" size={12} />
        </button>
        {fileMenuOpen && (
          <div style={s.fileMenu} onMouseLeave={() => setFileMenuOpen(false)}>
            {fileItems.map((item, i) =>
              item ? (
                <div key={i} style={s.fileItem}
                  onClick={() => handleFileAction(item[1])}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <Icon name={item[0]} size={13} color="var(--color-text-sec)" /> {item[1]}
                </div>
              ) : <div key={i} style={s.fileDivider} />
            )}
          </div>
        )}
      </div>

      <Tooltip label="Undo" shortcut="⌘Z" placement="bottom">
        <button style={{ ...s.iconBtn, opacity: canUndo() ? 1 : 0.35 }} onClick={undo} disabled={!canUndo()}>
          <Icon name="undo" size={16} />
        </button>
      </Tooltip>
      <Tooltip label="Redo" shortcut="⌘⇧Z" placement="bottom">
        <button style={{ ...s.iconBtn, opacity: canRedo() ? 1 : 0.35 }} onClick={redo} disabled={!canRedo()}>
          <Icon name="redo" size={16} />
        </button>
      </Tooltip>
      <div style={s.divider} />

      {isGuest ? (
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Guest session</span>
      ) : (
        <span style={{ fontSize: 12, color: saveColor[saveState], display: 'flex', alignItems: 'center', gap: 4 }}>
          {saveMap[saveState]}
        </span>
      )}

      <div style={{ flex: 1 }} />

      <div style={s.unitToggle}>
        <button style={s.unitBtn(units === 'ft')} onClick={() => setUnits('ft')}>ft</button>
        <button style={s.unitBtn(units === 'm')} onClick={() => setUnits('m')}>m</button>
      </div>

      <Tooltip label={nightMode ? 'Day Mode' : 'Night Mode'} placement="bottom">
        <button style={s.pillBtn(nightMode, '#6366F1')} onClick={() => setNightMode(!nightMode)}>
          <Icon name={nightMode ? 'sun' : 'moon'} size={14} color={nightMode ? '#6366F1' : 'var(--color-text-sec)'} />
          {nightMode && <span>Night</span>}
        </button>
      </Tooltip>

      <Tooltip label="Shadow Analysis" placement="bottom">
        <button style={s.pillBtn(false, '#D97706')} onClick={toggleShadowPanel}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="4" cy="5" r="2.2" fill="#FBBF24" stroke="none" />
            <line x1="4" y1="8" x2="8" y2="11" stroke="#FBBF24" strokeWidth="1" />
            <rect x="10" y="7" width="8" height="11" rx="0.5" fill="#F1F5F9" stroke="currentColor" />
            <path d="M18 18 L23 18 L20 14 L18 14 Z" fill="#CBD5E1" stroke="none" opacity="0.7" />
          </svg>
        </button>
      </Tooltip>

      <button style={s.pillBtn(mode3D, '#7C3AED')} onClick={() => setMode3D(!mode3D)}>
        <Icon name="cube3d" size={14} color={mode3D ? '#7C3AED' : 'var(--color-text-sec)'} />
        3D
      </button>
      <div style={s.divider} />

      <button style={s.shareBtn} onClick={toggleShareModal}>
        <Icon name="share" size={14} color="#fff" />
        Share
      </button>
      <div style={s.avatar}>JD</div>
    </div>
  )
}
