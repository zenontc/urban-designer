import React, { useMemo } from 'react'
import { ZoneHeader } from '../components/ZoneHeader'
import { useUIStore } from '../../store/uiStore'
import { useCanvasStore } from '../../store/canvasStore'
import { useProjectStore } from '../../store/projectStore'
import {
  polygonAreaSqFt, lineStringLengthFt,
  sqFtToAcres, sqFtToHa, ftToM, fmtNum,
} from '../../utils/geoUtils'

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

function exportMetricsCSV(features: import('../../store/canvasStore').UMPFeature[], projectName: string, units: 'ft' | 'm') {
  const rows = ['id,label,category,elementType,phase,geometry,area_or_length,unit']
  features.forEach(f => {
    const geom = f.geometry
    let val = '', unit = ''
    const coords = geom.type === 'Polygon' ? geom.coordinates[0]
      : geom.type === 'MultiPolygon' ? geom.coordinates[0][0] : null
    const lcoords = geom.type === 'LineString' ? geom.coordinates
      : geom.type === 'MultiLineString' ? geom.coordinates[0] : null
    if (coords) {
      const sqFt = polygonAreaSqFt(coords as [number,number][])
      val = units === 'm' ? fmtNum(sqFtToHa(sqFt), 4) : fmtNum(sqFtToAcres(sqFt), 4)
      unit = units === 'm' ? 'ha' : 'ac'
    } else if (lcoords) {
      const ft = lineStringLengthFt(lcoords as [number,number][])
      val = units === 'm' ? fmtNum(ftToM(ft)) : fmtNum(ft)
      unit = units === 'm' ? 'm' : 'ft'
    }
    rows.push(`${f.properties.id},"${f.properties.label}",${f.properties.category},${f.properties.elementType},${f.properties.phase},${geom.type},${val},${unit}`)
  })
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${projectName}-metrics.csv`; a.click()
  URL.revokeObjectURL(url)
}

const GREEN_CATS = ['landscape', 'parks', 'planting', 'green-infra']
const ROAD_CATS = ['streets']
const BUILDING_CATS = ['buildings']
const TREE_IDS = ['tree', 'street-tree']
const PARKING_CATS = ['parking']

export function MetricsZone() {
  const { zoneCollapsed, toggleZone, units } = useUIStore()
  const { features } = useCanvasStore()
  const { projectName } = useProjectStore()
  const collapsed = zoneCollapsed['metrics']

  const metrics = useMemo(() => {
    let totalAreaSqFt = 0, buildingAreaSqFt = 0, greenAreaSqFt = 0
    let totalLineFt = 0, roadLenFt = 0
    let pointCount = 0, treeCount = 0, parkingCount = 0, total = 0

    features.forEach(f => {
      total++
      const geom = f.geometry
      const cat = f.properties.category ?? ''
      const elType = f.properties.elementType ?? ''

      const coords = getPolygonCoords(geom)
      if (coords) {
        const a = polygonAreaSqFt(coords)
        totalAreaSqFt += a
        if (BUILDING_CATS.includes(cat)) buildingAreaSqFt += a
        if (GREEN_CATS.includes(cat)) greenAreaSqFt += a
      }
      const lcoords = getLineCoords(geom)
      if (lcoords) {
        const l = lineStringLengthFt(lcoords)
        totalLineFt += l
        if (ROAD_CATS.includes(cat)) roadLenFt += l
      }
      if (geom.type === 'Point' || geom.type === 'MultiPoint') {
        pointCount++
        if (TREE_IDS.includes(elType)) treeCount++
      }
      if (PARKING_CATS.includes(cat)) parkingCount++
    })

    return { total, totalAreaSqFt, buildingAreaSqFt, greenAreaSqFt, totalLineFt, roadLenFt, pointCount, treeCount, parkingCount }
  }, [features])

  function fmtArea(sqFt: number) {
    return units === 'm'
      ? { value: fmtNum(sqFtToHa(sqFt), 2), unit: 'ha' }
      : { value: fmtNum(sqFtToAcres(sqFt), 2), unit: 'ac' }
  }
  function fmtLen(ft: number) {
    return units === 'm'
      ? { value: fmtNum(ftToM(ft), 0), unit: 'm' }
      : { value: fmtNum(ft, 0), unit: 'ft' }
  }

  const buildA = fmtArea(metrics.buildingAreaSqFt)
  const greenA = fmtArea(metrics.greenAreaSqFt)
  const roadL = fmtLen(metrics.roadLenFt)

  const rows = [
    { label: 'Total Elements', value: fmtNum(metrics.total), unit: '', color: 'var(--color-text)' },
    { label: 'Building Footprint', value: buildA.value, unit: buildA.unit, color: '#94A3B8' },
    { label: 'Green / Open Space', value: greenA.value, unit: greenA.unit, color: '#4ADE80' },
    { label: 'Road Network', value: roadL.value, unit: roadL.unit, color: '#FBBF24' },
    { label: 'Trees', value: fmtNum(metrics.treeCount), unit: '', color: '#22C55E' },
    { label: 'Parking Areas', value: fmtNum(metrics.parkingCount), unit: '', color: '#60A5FA' },
  ]

  return (
    <ZoneHeader label="Metrics" collapsed={collapsed} onToggle={() => toggleZone('metrics')}>
      {/* Live metric rows */}
      <div style={{ padding: '6px 0', overflowY: 'auto', maxHeight: 240 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '3px 12px' }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{r.label}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: r.color, display: 'flex', alignItems: 'baseline', gap: 2 }}>
              {r.value}
              {r.unit && <span style={{ fontSize: 9, fontWeight: 400, color: 'var(--color-text-muted)' }}>{r.unit}</span>}
            </span>
          </div>
        ))}

        {/* Per-category breakdown */}
        {metrics.total > 0 && (
          <CategoryBreakdown features={features} />
        )}
      </div>

      {/* Empty state */}
      {metrics.total === 0 && (
        <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 11 }}>
          Draw elements on the map to see metrics
        </div>
      )}

      <div style={{ padding: '6px 10px', borderTop: '1px solid var(--color-border)' }}>
        <button
          onClick={() => exportMetricsCSV(features, projectName, units)}
          disabled={metrics.total === 0}
          style={{
            width: '100%', height: 26, fontSize: 11, fontWeight: 500, borderRadius: 4,
            border: '1px solid var(--color-border)', background: 'transparent',
            color: metrics.total === 0 ? 'var(--color-text-muted)' : 'var(--color-text-sec)',
            cursor: metrics.total === 0 ? 'default' : 'pointer',
          }}>
          Export CSV…
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
