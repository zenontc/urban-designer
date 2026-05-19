import React, { useState } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useCanvasStore } from '../../store/canvasStore'
import { ELEMENT_CATEGORIES } from '../../elements/categories'
import { CrossSectionInline } from '../CrossSectionInline'
import type { StreetLane } from '../CrossSectionInline'
import { lineStringLengthFt, polygonAreaSqFt, sqFtToAcres, sqFtToHa, ftToM, fmtNum } from '../../utils/geoUtils'
import type { UMPFeature } from '../../store/canvasStore'
import type { UMPFeatureProperties } from '../../elements/types'

function collectCoords(geom: GeoJSON.Geometry): [number, number][] {
  if (geom.type === 'Point') return [geom.coordinates as [number, number]]
  if (geom.type === 'LineString') return geom.coordinates as [number, number][]
  if (geom.type === 'Polygon') return geom.coordinates.flat() as [number, number][]
  if (geom.type === 'MultiPolygon') return geom.coordinates.flat(2) as [number, number][]
  return []
}

function getGeomBounds(geom: GeoJSON.Geometry) {
  const cs = collectCoords(geom)
  if (!cs.length) return null
  return {
    minLng: Math.min(...cs.map(c => c[0])),
    maxLng: Math.max(...cs.map(c => c[0])),
    minLat: Math.min(...cs.map(c => c[1])),
    maxLat: Math.max(...cs.map(c => c[1])),
  }
}

function translateCoord(c: number[], dLng: number, dLat: number): number[] {
  return [c[0] + dLng, c[1] + dLat, ...c.slice(2)]
}

function translateGeometry(geom: GeoJSON.Geometry, dLng: number, dLat: number): GeoJSON.Geometry {
  if (geom.type === 'Point') return { ...geom, coordinates: translateCoord(geom.coordinates as number[], dLng, dLat) }
  if (geom.type === 'LineString') return { ...geom, coordinates: geom.coordinates.map(c => translateCoord(c, dLng, dLat)) }
  if (geom.type === 'Polygon') return { ...geom, coordinates: geom.coordinates.map(ring => ring.map(c => translateCoord(c, dLng, dLat))) }
  if (geom.type === 'MultiPolygon') return { ...geom, coordinates: geom.coordinates.map(poly => poly.map(ring => ring.map(c => translateCoord(c, dLng, dLat)))) }
  return geom
}

const PHASES: UMPFeatureProperties['phase'][] = ['existing', 'phase-1', 'phase-2', 'phase-3']
const PHASE_LABELS: Record<string, string> = {
  existing: 'Existing', 'phase-1': 'Phase 1', 'phase-2': 'Phase 2', 'phase-3': 'Phase 3',
}

function computeStats(feature: UMPFeature, units: 'ft' | 'm') {
  const geom = feature.geometry
  if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
    const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0]
    const sqFt = polygonAreaSqFt(coords)
    const acres = sqFtToAcres(sqFt)
    const sqM = sqFt * 0.0929
    const ha = sqFtToHa(sqFt)
    return units === 'ft'
      ? [{ label: 'Area', value: `${fmtNum(sqFt)} ft²` }, { label: 'Acres', value: fmtNum(acres, 2) }]
      : [{ label: 'Area', value: `${fmtNum(sqM)} m²` }, { label: 'Hectares', value: fmtNum(ha, 2) }]
  }
  if (geom.type === 'LineString' || geom.type === 'MultiLineString') {
    const coords = geom.type === 'LineString' ? geom.coordinates : geom.coordinates[0]
    const ft = lineStringLengthFt(coords)
    const m = ftToM(ft)
    return [{ label: 'Length', value: units === 'ft' ? `${fmtNum(ft)} ft` : `${fmtNum(m)} m` }]
  }
  return []
}

export function DetailsZone() {
  const { units } = useUIStore()
  const { selectedIds, features, updateFeature, deleteFeature, updateGeometry } = useCanvasStore()

  const selectedFeatures = features.filter(f => selectedIds.includes(f.properties.id))
  const single = selectedFeatures.length === 1 ? selectedFeatures[0] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {single ? (
        <>
          <FeatureEditor feature={single} updateFeature={updateFeature} deleteFeature={deleteFeature} units={units} />
          {single.properties.category === 'streets' && (
            <>
              <div style={{ height: 1, background: 'var(--color-border)' }} />
              <CrossSectionInline
                feature={single}
                onUpdate={(lanes: StreetLane[]) => updateFeature(single.properties.id, { streetLanes: lanes })}
              />
            </>
          )}
        </>
      ) : selectedFeatures.length > 1 ? (
        <MultiSelection features={selectedFeatures} updateFeature={updateFeature} updateGeometry={updateGeometry} />
      ) : (
        <EmptyState />
      )}
    </div>
  )
}

function FeatureEditor({
  feature,
  updateFeature,
  deleteFeature,
  units,
}: {
  feature: UMPFeature
  updateFeature: (id: string, props: Partial<UMPFeatureProperties>) => void
  deleteFeature: (id: string) => void
  units: 'ft' | 'm'
}) {
  const p = feature.properties
  const stats = computeStats(feature, units)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const catDef = ELEMENT_CATEGORIES.flatMap(c => c.elements).find(e => e.id === p.elementType)

  function set<K extends keyof UMPFeatureProperties>(key: K, value: UMPFeatureProperties[K]) {
    updateFeature(p.id, { [key]: value } as Partial<UMPFeatureProperties>)
  }

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: catDef?.color ?? p.style.strokeColor, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flex: 1 }}>{p.category} › {p.elementType}</span>
      </div>

      <div style={{ height: 1, background: 'var(--color-border)' }} />

      {/* Label */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Label</span>
        <input
          value={p.label}
          onChange={e => set('label', e.target.value)}
          style={{ height: 28, padding: '0 8px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none', width: '100%' }}
        />
      </div>

      {/* Phase */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Phase</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {PHASES.map(ph => (
            <button key={ph} onClick={() => set('phase', ph)} style={{
              flex: 1, height: 26, fontSize: 10, fontWeight: p.phase === ph ? 600 : 400,
              borderRadius: 4, border: `1px solid ${p.phase === ph ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: p.phase === ph ? 'var(--color-accent-subtle)' : 'transparent',
              color: p.phase === ph ? 'var(--color-accent)' : 'var(--color-text-muted)',
              cursor: 'pointer',
            }}>
              {PHASE_LABELS[ph].replace('Phase ', 'P')}
            </button>
          ))}
        </div>
      </div>

      {/* Style */}
      <div>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', display: 'block', marginBottom: 6 }}>Style</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Stroke</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <input type="color" value={p.style.strokeColor}
                onChange={e => updateFeature(p.id, { style: { ...p.style, strokeColor: e.target.value } })}
                style={{ width: 24, height: 24, padding: 0, border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', background: 'none' }} />
              <input type="range" min={1} max={12} value={p.style.strokeWidth}
                onChange={e => updateFeature(p.id, { style: { ...p.style, strokeWidth: Number(e.target.value) } })}
                style={{ width: 60 }} />
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 18 }}>{p.style.strokeWidth}px</span>
            </div>
          </div>
          {(feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Fill</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <input type="color" value={p.style.fillColor}
                  onChange={e => updateFeature(p.id, { style: { ...p.style, fillColor: e.target.value } })}
                  style={{ width: 24, height: 24, padding: 0, border: '1px solid var(--color-border)', borderRadius: 3, cursor: 'pointer', background: 'none' }} />
                <input type="range" min={0} max={100} value={p.style.fillOpacity}
                  onChange={e => updateFeature(p.id, { style: { ...p.style, fillOpacity: Number(e.target.value) } })}
                  style={{ width: 60 }} />
                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', width: 24 }}>{p.style.fillOpacity}%</span>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Line type</span>
            <select value={p.style.lineType}
              onChange={e => updateFeature(p.id, { style: { ...p.style, lineType: e.target.value as typeof p.style.lineType } })}
              style={{ height: 24, fontSize: 11, borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text)', padding: '0 4px' }}>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
        </div>
      </div>

      {/* Geometry stats */}
      {stats.length > 0 && (
        <>
          <div style={{ height: 1, background: 'var(--color-border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Geometry</span>
            {stats.map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{s.label}</span>
                <span style={{ fontSize: 11, color: 'var(--color-text)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Element-specific controls */}
      <ElementSpecificControls feature={feature} updateFeature={updateFeature} />

      {/* Flags */}
      <div style={{ display: 'flex', gap: 8 }}>
        <FlagToggle label="In Metrics" value={p.inMetrics} onChange={v => set('inMetrics', v)} />
        <FlagToggle label="Visible" value={p.visible} onChange={v => set('visible', v)} />
        <FlagToggle label="Locked" value={p.locked} onChange={v => set('locked', v)} />
      </div>

      <div style={{ height: 1, background: 'var(--color-border)' }} />

      {/* Delete */}
      {confirmDelete ? (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => deleteFeature(p.id)} style={{ flex: 1, height: 28, fontSize: 11, fontWeight: 600, borderRadius: 4, border: 'none', background: '#EF4444', color: '#fff', cursor: 'pointer' }}>
            Delete
          </button>
          <button onClick={() => setConfirmDelete(false)} style={{ flex: 1, height: 28, fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-sec)', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} style={{ height: 28, width: '100%', fontSize: 11, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', color: '#EF4444', cursor: 'pointer' }}>
          Delete Feature
        </button>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>{children}</div>
    </div>
  )
}

function NumInput({ value, min, max, step = 1, onChange }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <input type="number" value={value} min={min} max={max} step={step}
      onChange={e => onChange(Number(e.target.value))}
      style={{ width: 54, height: 24, padding: '0 5px', fontSize: 11, borderRadius: 3, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none', textAlign: 'right' }} />
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', display: 'block', marginBottom: 5, marginTop: 2 }}>
      {children}
    </span>
  )
}

function ElementSpecificControls({ feature, updateFeature }: { feature: UMPFeature; updateFeature: (id: string, props: Partial<UMPFeatureProperties>) => void }) {
  const p = feature.properties
  const elType = p.elementType
  const any = p as unknown as Record<string, number | string | boolean>

  function setProp(key: string, value: number | string | boolean) {
    updateFeature(p.id, { [key]: value } as Partial<UMPFeatureProperties>)
  }

  // Street tree row
  if (elType === 'street-tree') {
    const spacing = (any.treeSpacing as number) ?? 30
    const size    = (any.treeSize    as number) ?? 10
    return (
      <div>
        <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 8 }} />
        <SectionLabel>Tree Options</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Row label="Spacing (ft)">
            <input type="range" min={10} max={80} step={5} value={spacing}
              onChange={e => setProp('treeSpacing', Number(e.target.value))} style={{ width: 60 }} />
            <NumInput value={spacing} min={10} max={80} step={5} onChange={v => setProp('treeSpacing', v)} />
          </Row>
          <Row label="Canopy size (ft)">
            <input type="range" min={4} max={40} step={2} value={size}
              onChange={e => setProp('treeSize', Number(e.target.value))} style={{ width: 60 }} />
            <NumInput value={size} min={4} max={40} step={2} onChange={v => setProp('treeSize', v)} />
          </Row>
        </div>
      </div>
    )
  }

  // Parking - stall dimensions
  if (elType === 'parallel-parking' || elType === 'headin-parking' || elType === 'diagonal-parking') {
    const isParallel = elType === 'parallel-parking'
    const defaultSpacing = isParallel ? 22 : 9
    const defaultDepth   = isParallel ? 8 : 18
    const spacing = (any.stallSpacing as number) ?? defaultSpacing
    const depth   = (any.stallDepth   as number) ?? defaultDepth
    return (
      <div>
        <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 8 }} />
        <SectionLabel>Stall Dimensions</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Row label={isParallel ? 'Stall length (ft)' : 'Stall width (ft)'}>
            <NumInput value={spacing} min={8} max={30} onChange={v => setProp('stallSpacing', v)} />
          </Row>
          <Row label={isParallel ? 'Stall width (ft)' : 'Stall depth (ft)'}>
            <NumInput value={depth} min={6} max={25} onChange={v => setProp('stallDepth', v)} />
          </Row>
        </div>
      </div>
    )
  }

  // Building height / floors
  if (p.category === 'buildings' && 'floors' in any) {
    const floors = (any.floors as number) ?? 2
    return (
      <div>
        <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 8 }} />
        <SectionLabel>Building</SectionLabel>
        <Row label="Floors">
          <input type="range" min={1} max={60} value={floors}
            onChange={e => setProp('floors', Number(e.target.value))} style={{ width: 60 }} />
          <NumInput value={floors} min={1} max={60} onChange={v => setProp('floors', v)} />
        </Row>
      </div>
    )
  }

  // Speed sign
  if (elType === 'speed-sign') {
    const speed = (any.speed as number) ?? 25
    return (
      <div>
        <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 8 }} />
        <SectionLabel>Sign</SectionLabel>
        <Row label="Speed limit">
          <NumInput value={speed} min={5} max={85} step={5} onChange={v => setProp('speed', v)} />
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>mph</span>
        </Row>
      </div>
    )
  }

  // Parking structure / deck (levels)
  if (elType === 'parking-deck-bldg' || elType === 'parking-deck') {
    const levels = (any.levels as number) ?? 4
    return (
      <div>
        <div style={{ height: 1, background: 'var(--color-border)', marginBottom: 8 }} />
        <SectionLabel>Structure</SectionLabel>
        <Row label="Levels">
          <input type="range" min={1} max={12} value={levels}
            onChange={e => setProp('levels', Number(e.target.value))} style={{ width: 60 }} />
          <NumInput value={levels} min={1} max={12} onChange={v => setProp('levels', v)} />
        </Row>
      </div>
    )
  }

  return null
}

function FlagToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      flex: 1, height: 24, fontSize: 10, fontWeight: value ? 600 : 400, borderRadius: 4,
      border: `1px solid ${value ? 'var(--color-accent)' : 'var(--color-border)'}`,
      background: value ? 'var(--color-accent-subtle)' : 'transparent',
      color: value ? 'var(--color-accent)' : 'var(--color-text-muted)',
      cursor: 'pointer',
    }}>
      {label}
    </button>
  )
}

function MultiSelection({ features, updateFeature, updateGeometry }: {
  features: UMPFeature[]
  updateFeature: (id: string, props: Partial<UMPFeatureProperties>) => void
  updateGeometry: (id: string, geom: GeoJSON.Geometry) => void
}) {
  function setPhaseAll(phase: UMPFeatureProperties['phase']) {
    features.forEach(f => updateFeature(f.properties.id, { phase }))
  }

  function align(type: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') {
    const bounds = features.map(f => ({ f, b: getGeomBounds(f.geometry) })).filter(x => x.b)
    if (bounds.length < 2) return

    let target: number
    if (type === 'left')    target = Math.min(...bounds.map(x => x.b!.minLng))
    else if (type === 'right')   target = Math.max(...bounds.map(x => x.b!.maxLng))
    else if (type === 'centerH') target = bounds.reduce((s, x) => s + (x.b!.minLng + x.b!.maxLng) / 2, 0) / bounds.length
    else if (type === 'top')     target = Math.max(...bounds.map(x => x.b!.maxLat))
    else if (type === 'bottom')  target = Math.min(...bounds.map(x => x.b!.minLat))
    else                         target = bounds.reduce((s, x) => s + (x.b!.minLat + x.b!.maxLat) / 2, 0) / bounds.length

    bounds.forEach(({ f, b }) => {
      const isH = ['left', 'centerH', 'right'].includes(type)
      const current = isH
        ? (type === 'left' ? b!.minLng : type === 'right' ? b!.maxLng : (b!.minLng + b!.maxLng) / 2)
        : (type === 'top'  ? b!.maxLat : type === 'bottom' ? b!.minLat : (b!.minLat + b!.maxLat) / 2)
      const delta = target - current
      const newGeom = translateGeometry(f.geometry, isH ? delta : 0, isH ? 0 : delta)
      updateGeometry(f.properties.id, newGeom)
    })
  }

  const alignBtn = (label: string, action: () => void, title: string) => (
    <button key={label} onClick={action} title={title} style={{
      flex: 1, height: 26, fontSize: 9, fontWeight: 600, borderRadius: 4,
      border: '1px solid var(--color-border)', background: 'transparent',
      color: 'var(--color-text-sec)', cursor: 'pointer', padding: 0,
    }}>{label}</button>
  )

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text)', fontWeight: 500 }}>
        {features.length} features selected
      </div>

      {/* Align */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Align</span>
        <div style={{ display: 'flex', gap: 3 }}>
          {alignBtn('⊢ Left',  () => align('left'),    'Align left edges')}
          {alignBtn('⊣⊢ H',   () => align('centerH'), 'Center horizontally')}
          {alignBtn('Right ⊣', () => align('right'),   'Align right edges')}
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {alignBtn('⊤ Top',   () => align('top'),     'Align top edges')}
          {alignBtn('⊥⊤ V',   () => align('centerV'), 'Center vertically')}
          {alignBtn('Bot ⊥',  () => align('bottom'),  'Align bottom edges')}
        </div>
      </div>

      {/* Phase */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Set Phase</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {PHASES.map(ph => (
            <button key={ph} onClick={() => setPhaseAll(ph)} style={{
              flex: 1, height: 26, fontSize: 10, fontWeight: 400,
              borderRadius: 4, border: '1px solid var(--color-border)',
              background: 'transparent', color: 'var(--color-text-muted)', cursor: 'pointer',
            }}>
              {PHASE_LABELS[ph].replace('Phase ', 'P')}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 11 }}>
      Click a feature on the map to select it
    </div>
  )
}
