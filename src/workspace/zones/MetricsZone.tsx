import React, { useState, useMemo } from 'react'
import { ZoneHeader } from '../components/ZoneHeader'
import { useUIStore } from '../../store/uiStore'
import { useCanvasStore } from '../../store/canvasStore'
import {
  polygonAreaSqFt, lineStringLengthFt,
  sqFtToAcres, sqFtToHa, ftToM, fmtNum,
} from '../../utils/geoUtils'

type Phase = 'all' | 'existing' | 'phase-1' | 'phase-2' | 'phase-3'

const PHASE_TABS: Array<{ id: Phase; label: string; color: string }> = [
  { id: 'all',      label: 'All',  color: '#6366F1' },
  { id: 'existing', label: 'Exist',color: '#64748B' },
  { id: 'phase-1',  label: 'Ph1',  color: '#22C55E' },
  { id: 'phase-2',  label: 'Ph2',  color: '#F59E0B' },
  { id: 'phase-3',  label: 'Ph3',  color: '#EF4444' },
]

function getPolygonCoords(geometry: GeoJSON.Geometry): number[][] | null {
  if (geometry.type === 'Polygon') return geometry.coordinates[0]
  if (geometry.type === 'MultiPolygon') return geometry.coordinates[0][0]
  return null
}
function getLineCoords(geometry: GeoJSON.Geometry): number[][] | null {
  if (geometry.type === 'LineString') return geometry.coordinates
  if (geometry.type === 'MultiLineString') return geometry.coordinates[0]
  return null
}

export function MetricsZone() {
  const { zoneCollapsed, toggleZone, units } = useUIStore()
  const { features } = useCanvasStore()
  const [phase, setPhase] = useState<Phase>('all')
  const collapsed = zoneCollapsed['metrics']

  const filtered = useMemo(() => {
    if (phase === 'all') return features
    return features.filter(f => f.properties.phase === phase)
  }, [features, phase])

  const metrics = useMemo(() => {
    let totalAreaSqFt = 0
    let totalLineFt = 0
    let pointCount = 0
    let polyCount = 0
    let lineCount = 0

    filtered.forEach(f => {
      const geom = f.geometry
      const coords = getPolygonCoords(geom)
      if (coords) {
        totalAreaSqFt += polygonAreaSqFt(coords)
        polyCount++
      }
      const lcoords = getLineCoords(geom)
      if (lcoords) {
        totalLineFt += lineStringLengthFt(lcoords)
        lineCount++
      }
      if (geom.type === 'Point' || geom.type === 'MultiPoint') pointCount++
    })

    return { totalAreaSqFt, totalLineFt, pointCount, polyCount, lineCount, total: filtered.length }
  }, [filtered])

  // Format based on unit preference
  const areaDisplay = units === 'm'
    ? { value: fmtNum(sqFtToHa(metrics.totalAreaSqFt), 2), unit: 'ha' }
    : { value: fmtNum(sqFtToAcres(metrics.totalAreaSqFt), 2), unit: 'ac' }

  const lengthDisplay = units === 'm'
    ? { value: fmtNum(ftToM(metrics.totalLineFt)), unit: 'm' }
    : { value: fmtNum(metrics.totalLineFt), unit: 'ft' }

  const rows = [
    { label: 'Total Features', value: fmtNum(metrics.total), unit: '' },
    { label: 'Polygons / Area', value: `${metrics.polyCount} / ${areaDisplay.value}`, unit: areaDisplay.unit },
    { label: 'Lines / Length',  value: `${metrics.lineCount} / ${lengthDisplay.value}`, unit: lengthDisplay.unit },
    { label: 'Points / Objects',value: fmtNum(metrics.pointCount), unit: '' },
  ]

  return (
    <ZoneHeader label="Metrics" collapsed={collapsed} onToggle={() => toggleZone('metrics')}>
      {/* Phase tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '4px 8px', gap: 4 }}>
        {PHASE_TABS.map(tab => (
          <button key={tab.id} onClick={() => setPhase(tab.id)} style={{
            flex: 1, height: 22, fontSize: 10, fontWeight: phase === tab.id ? 700 : 400,
            borderRadius: 3, border: `1px solid ${phase === tab.id ? tab.color : 'var(--color-border)'}`,
            background: phase === tab.id ? `${tab.color}18` : 'transparent',
            color: phase === tab.id ? tab.color : 'var(--color-text-sec)', cursor: 'pointer',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Live metric rows */}
      <div style={{ padding: '6px 0', overflowY: 'auto', maxHeight: 180 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '3px 12px' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{r.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'baseline', gap: 2 }}>
              {r.value}
              {r.unit && <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--color-text-muted)' }}>{r.unit}</span>}
            </span>
          </div>
        ))}

        {/* Per-category breakdown */}
        {metrics.total > 0 && (
          <CategoryBreakdown features={filtered} />
        )}
      </div>

      {/* Empty state */}
      {metrics.total === 0 && (
        <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 11 }}>
          Draw elements on the map to see metrics
        </div>
      )}

      <div style={{ padding: '6px 10px', borderTop: '1px solid var(--color-border)' }}>
        <button style={{
          width: '100%', height: 26, fontSize: 11, fontWeight: 500, borderRadius: 4,
          border: '1px solid var(--color-border)', background: 'transparent',
          color: 'var(--color-text-sec)', cursor: 'pointer',
        }}>
          Export Report…
        </button>
      </div>
    </ZoneHeader>
  )
}

function CategoryBreakdown({ features }: { features: import('../../store/canvasStore').UMPFeature[] }) {
  const counts: Record<string, number> = {}
  features.forEach(f => {
    const cat = f.properties.category ?? 'Other'
    counts[cat] = (counts[cat] ?? 0) + 1
  })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
  if (sorted.length === 0) return null

  return (
    <>
      <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 12px 4px' }} />
      <div style={{ padding: '2px 12px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>By Category</div>
      {sorted.map(([cat, count]) => (
        <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 12px' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{cat}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text)' }}>{count}</span>
        </div>
      ))}
    </>
  )
}
