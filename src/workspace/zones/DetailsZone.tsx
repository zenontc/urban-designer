import React, { useState } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useCanvasStore } from '../../store/canvasStore'
import { ELEMENT_CATEGORIES } from '../../elements/categories'
import { CrossSectionInline } from '../CrossSectionInline'
import { lineStringLengthFt, polygonAreaSqFt, sqFtToAcres, sqFtToHa, ftToM, fmtNum } from '../../utils/geoUtils'
import type { UMPFeature } from '../../store/canvasStore'
import type { UMPFeatureProperties } from '../../elements/types'

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
  const { selectedIds, features, updateFeature, deleteFeature } = useCanvasStore()

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
              <CrossSectionInline />
            </>
          )}
        </>
      ) : selectedFeatures.length > 1 ? (
        <MultiSelection features={selectedFeatures} updateFeature={updateFeature} />
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

function MultiSelection({ features, updateFeature }: {
  features: UMPFeature[]
  updateFeature: (id: string, props: Partial<UMPFeatureProperties>) => void
}) {
  function setPhaseAll(phase: UMPFeatureProperties['phase']) {
    features.forEach(f => updateFeature(f.properties.id, { phase }))
  }

  return (
    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: 'var(--color-text)', fontWeight: 500 }}>
        {features.length} features selected
      </div>
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
