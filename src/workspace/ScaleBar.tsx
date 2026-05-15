import React from 'react'
import { useMapStore } from '../store/mapStore'

const SCALES = [
  { label: "1\"=10'",  ftPerIn: 10 },
  { label: "1\"=20'",  ftPerIn: 20 },
  { label: "1\"=50'",  ftPerIn: 50 },
  { label: "1\"=100'", ftPerIn: 100 },
  { label: "1\"=200'", ftPerIn: 200 },
  { label: "1\"=400'", ftPerIn: 400 },
  { label: "1\"=800'", ftPerIn: 800 },
]

export function ScaleBar() {
  const { zoom, center, mapInstance } = useMapStore()
  const lat = center[1]

  // Compute current scale: feet per inch at 96 DPI
  const metersPerPixel = 40075016.68 * Math.cos(lat * Math.PI / 180) / (256 * Math.pow(2, zoom))
  const feetPerInch = metersPerPixel * 3.28084 * 96

  function zoomToScale(ftPerIn: number) {
    const targetMpP = (ftPerIn / 96) / 3.28084
    const targetZoom = Math.log2(40075016.68 * Math.cos(lat * Math.PI / 180) / (256 * targetMpP))
    mapInstance?.flyTo({ zoom: targetZoom, duration: 500 })
  }

  const closest = SCALES.reduce((prev, cur) =>
    Math.abs(cur.ftPerIn - feetPerInch) < Math.abs(prev.ftPerIn - feetPerInch) ? cur : prev
  )

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 32, zIndex: 25,
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '0 12px',
      background: 'var(--color-bg-panel)',
      borderTop: '1px solid var(--color-border)',
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginRight: 6, whiteSpace: 'nowrap' }}>
        Scale: 1″ ≈ {Math.round(feetPerInch)}′
      </span>
      <div style={{ width: 1, height: 16, background: 'var(--color-border)' }} />
      {SCALES.map(s => (
        <button
          key={s.label}
          onClick={() => zoomToScale(s.ftPerIn)}
          style={{
            height: 22, padding: '0 7px', fontSize: 10, borderRadius: 3, cursor: 'pointer',
            border: `1px solid ${s === closest ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: s === closest ? 'var(--color-accent-subtle)' : 'transparent',
            color: s === closest ? 'var(--color-accent)' : 'var(--color-text-muted)',
            fontWeight: s === closest ? 600 : 400,
            whiteSpace: 'nowrap',
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}
