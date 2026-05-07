import React, { useRef, useState, useCallback } from 'react'
import { useMapStore } from '../../store/mapStore'

export function MapOrientationControl() {
  const { mapInstance, rotation, zoom, pitch } = useMapStore()
  const [dragging, setDragging] = useState(false)
  const startAngle = useRef(0)
  const startBearing = useRef(0)

  const getAngleFromCenter = useCallback((e: MouseEvent, rect: DOMRect) => {
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    return Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI)
  }, [])

  function handleCompassMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!mapInstance) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    startAngle.current = getAngleFromCenter(e.nativeEvent, rect)
    startBearing.current = mapInstance.getBearing()
    setDragging(true)

    const onMove = (ev: MouseEvent) => {
      const delta = getAngleFromCenter(ev, rect) - startAngle.current
      mapInstance.setBearing(startBearing.current + delta)
    }
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function resetNorth() {
    if (!mapInstance) return
    mapInstance.easeTo({ bearing: 0, pitch: 0, duration: 400 })
  }

  function zoomIn() { mapInstance?.zoomIn({ duration: 200 }) }
  function zoomOut() { mapInstance?.zoomOut({ duration: 200 }) }

  const btnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 6, border: '1px solid var(--color-border)',
    background: 'var(--color-bg-panel)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--color-text-sec)', fontSize: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
    userSelect: 'none',
  }

  return (
    <div style={{
      position: 'absolute', bottom: 48, right: 12,
      display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10,
    }}>
      {/* Compass rose */}
      <div
        onMouseDown={handleCompassMouseDown}
        title="Drag to rotate · Click to reset north"
        onClick={resetNorth}
        style={{
          ...btnStyle, cursor: dragging ? 'grabbing' : 'grab',
          position: 'relative',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" style={{ transform: `rotate(${rotation}deg)`, transition: dragging ? 'none' : 'transform 200ms ease' }}>
          {/* N arrow */}
          <polygon points="12,2 14.5,11 12,9.5 9.5,11" fill="#EF4444" />
          {/* S arrow */}
          <polygon points="12,22 14.5,13 12,14.5 9.5,13" fill="#94A3B8" />
          {/* Center dot */}
          <circle cx="12" cy="12" r="1.5" fill="var(--color-text-sec)" />
        </svg>
      </div>

      {/* Pitch indicator */}
      <div style={{ ...btnStyle, cursor: 'default', fontSize: 9, fontWeight: 600, flexDirection: 'column', gap: 0 }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 8 }}>TILT</span>
        <span style={{ color: 'var(--color-text-sec)', fontSize: 11 }}>{Math.round(pitch)}°</span>
      </div>

      {/* Zoom in */}
      <button style={btnStyle} onClick={zoomIn} title="Zoom in">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="7" y1="1" x2="7" y2="13" /><line x1="1" y1="7" x2="13" y2="7" />
        </svg>
      </button>

      {/* Zoom level */}
      <div style={{ ...btnStyle, cursor: 'default', fontSize: 10, fontWeight: 600, color: 'var(--color-text-sec)' }}>
        {zoom.toFixed(1)}
      </div>

      {/* Zoom out */}
      <button style={btnStyle} onClick={zoomOut} title="Zoom out">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="1" y1="7" x2="13" y2="7" />
        </svg>
      </button>
    </div>
  )
}
