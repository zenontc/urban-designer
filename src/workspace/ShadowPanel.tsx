import React, { useState, useRef, useCallback, useEffect } from 'react'
import SunCalc from 'suncalc'
import { Icon } from './components/Icon'
import { useMapStore } from '../store/mapStore'
import { useUIStore } from '../store/uiStore'

function pad2(n: number) { return String(Math.floor(n)).padStart(2, '0') }
function fmt(d: Date) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function ShadowPanel() {
  const { toggleShadowPanel, setShadowSun } = useUIStore()
  const { center } = useMapStore()

  const [date, setDate] = useState(() => {
    const d = new Date(); d.setHours(12, 0, 0, 0); return d
  })
  const [playing, setPlaying] = useState(false)
  const intervalRef = useRef<number>(0)

  // Compute sun position and push to store for map shadow rendering
  const pos = SunCalc.getPosition(date, center[1], center[0])
  useEffect(() => { setShadowSun(pos.azimuth, pos.altitude) }, [pos.azimuth, pos.altitude, setShadowSun])
  const azimuthDeg = (pos.azimuth * 180 / Math.PI + 180) % 360
  const altitudeDeg = pos.altitude * 180 / Math.PI
  const isDaytime = pos.altitude > 0

  // Compute shadow length multiplier based on altitude
  const shadowLen = isDaytime ? Math.max(0.5, 1 / Math.tan(Math.max(0.05, pos.altitude))) : 0
  const shadowX = isDaytime ? Math.cos((azimuthDeg + 180) * Math.PI / 180) * shadowLen : 0
  const shadowY = isDaytime ? Math.sin((azimuthDeg + 180) * Math.PI / 180) * shadowLen : 0

  // Day slider: minutes since midnight
  const minutesInDay = date.getHours() * 60 + date.getMinutes()

  function setTimeOfDay(minutes: number) {
    const d = new Date(date)
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
    setDate(d)
  }

  function setDayOfYear(day: number) {
    const d = new Date(date.getFullYear(), 0, 1)
    d.setDate(d.getDate() + day)
    d.setHours(date.getHours(), date.getMinutes(), 0, 0)
    setDate(d)
  }

  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000) - 1

  function togglePlay() {
    if (playing) {
      clearInterval(intervalRef.current)
      setPlaying(false)
    } else {
      setPlaying(true)
      intervalRef.current = window.setInterval(() => {
        setDate(d => {
          const next = new Date(d)
          next.setMinutes(next.getMinutes() + 15)
          if (next.getHours() >= 22) { next.setHours(5, 0, 0, 0) }
          return next
        })
      }, 120)
    }
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  // Draggable panel
  const panelRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const offset = useRef({ x: 0, y: 0 })
  const [pos2, setPos2] = useState({ x: 80, y: 80 })

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    offset.current = { x: e.clientX - pos2.x, y: e.clientY - pos2.y }
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return
      setPos2({ x: ev.clientX - offset.current.x, y: ev.clientY - offset.current.y })
    }
    const onUp = () => { dragging.current = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pos2])

  const sunColor = altitudeDeg > 30 ? '#FBBF24' : altitudeDeg > 0 ? '#F97316' : '#6366F1'

  return (
    <div ref={panelRef} style={{
      position: 'absolute', left: pos2.x, top: pos2.y, zIndex: 200,
      width: 280, background: 'var(--color-bg-panel)',
      borderRadius: 10, border: '1px solid var(--color-border)',
      boxShadow: '0 8px 32px rgba(15,23,42,0.18)',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div onMouseDown={onMouseDown} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid var(--color-border)', cursor: 'grab', gap: 8 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" strokeWidth="1.5">
          <circle cx="4" cy="5" r="2.2" fill="#FBBF24" stroke="none" />
          <line x1="4" y1="8" x2="8" y2="11" stroke="#FBBF24" strokeWidth="1" />
          <rect x="10" y="7" width="8" height="11" rx="0.5" fill="#F1F5F9" stroke="currentColor" />
          <path d="M18 18 L23 18 L20 14 L18 14 Z" fill="#CBD5E1" stroke="none" opacity="0.7" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text)', flex: 1 }}>Shadow Analysis</span>
        <button onClick={toggleShadowPanel} style={{ width: 20, height: 20, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="x" size={14} />
        </button>
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Sun dial */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
            {/* Compass circle */}
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="38" fill="none" stroke="var(--color-border)" strokeWidth="1" />
              {['N','E','S','W'].map((dir, i) => {
                const angle = i * 90 - 90
                const x = 40 + 34 * Math.cos(angle * Math.PI / 180)
                const y = 40 + 34 * Math.sin(angle * Math.PI / 180)
                return <text key={dir} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="8" fill="var(--color-text-muted)">{dir}</text>
              })}
              {/* Building */}
              <rect x="35" y="30" width="10" height="14" rx="1" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1" />
              {/* Shadow */}
              {isDaytime && (
                <polygon
                  points={`35,44 45,44 ${45 + shadowX * 8},${44 + shadowY * 8} ${35 + shadowX * 8},${44 + shadowY * 8}`}
                  fill="rgba(30,41,59,0.25)"
                />
              )}
              {/* Sun indicator */}
              {isDaytime && (
                <circle
                  cx={40 + 28 * Math.sin(azimuthDeg * Math.PI / 180)}
                  cy={40 - 28 * Math.cos(azimuthDeg * Math.PI / 180)}
                  r="6" fill={sunColor}
                />
              )}
              {!isDaytime && (
                <circle cx="40" cy="40" r="6" fill="#6366F1" opacity="0.5" />
              )}
            </svg>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)', letterSpacing: '-0.03em' }}>{fmt(date)}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {MONTHS[date.getMonth()]} {date.getDate()}, {date.getFullYear()}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Stat label="Azimuth" value={`${Math.round(azimuthDeg)}°`} color={sunColor} />
              <Stat label="Altitude" value={`${Math.round(altitudeDeg)}°`} color={sunColor} />
            </div>
            <div style={{ fontSize: 10, fontWeight: 600, color: isDaytime ? '#22C55E' : '#6366F1', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {isDaytime ? `Sun ${Math.round(altitudeDeg)}° above horizon` : 'Night'}
            </div>
          </div>
        </div>

        {/* Time slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>5:00</span>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>12:00</span>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>22:00</span>
          </div>
          <input type="range" min={300} max={1320} step={15} value={minutesInDay}
            onChange={e => setTimeOfDay(Number(e.target.value))}
            style={{ width: '100%', accentColor: sunColor }} />
        </div>

        {/* Date slider */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Jan</span>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Jul</span>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>Dec</span>
          </div>
          <input type="range" min={0} max={364} step={1} value={dayOfYear}
            onChange={e => setDayOfYear(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#6366F1' }} />
        </div>

        {/* Quick date presets */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {[
            { label: 'Spring Eq.', m: 2, d: 20 },
            { label: 'Summer Sol.', m: 5, d: 21 },
            { label: 'Fall Eq.', m: 8, d: 22 },
            { label: 'Winter Sol.', m: 11, d: 21 },
          ].map(p => (
            <button key={p.label} onClick={() => {
              const nd = new Date(date.getFullYear(), p.m, p.d, date.getHours(), date.getMinutes())
              setDate(nd)
            }} style={{ flex: '1 0 calc(50% - 4px)', padding: '3px 0', fontSize: 9, borderRadius: 4, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-sec)' }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Playback */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={togglePlay} style={{ height: 28, padding: '0 12px', borderRadius: 5, border: '1px solid var(--color-border)', background: playing ? '#F59E0B18' : 'transparent', color: playing ? '#F59E0B' : 'var(--color-text-sec)', cursor: 'pointer', fontSize: 11, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
            {playing ? <Icon name="minus" size={12} /> : <Icon name="arrowRight" size={12} />}
            {playing ? 'Pause' : 'Animate'}
          </button>
          <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>15-min steps</span>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 9, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}
