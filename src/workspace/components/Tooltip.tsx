import React, { useState, useRef } from 'react'

interface TooltipProps {
  label: string
  shortcut?: string
  placement?: 'right' | 'bottom' | 'top' | 'left'
  children: React.ReactNode
}

const placements = {
  right:  { left: '110%', top: '50%', transform: 'translateY(-50%)' },
  bottom: { top: '110%', left: '50%', transform: 'translateX(-50%)' },
  top:    { bottom: '110%', left: '50%', transform: 'translateX(-50%)' },
  left:   { right: '110%', top: '50%', transform: 'translateY(-50%)' },
} as const

export function Tooltip({ label, shortcut, placement = 'right', children }: TooltipProps) {
  const [show, setShow] = useState(false)
  const timer = useRef<number>(0)

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => { timer.current = window.setTimeout(() => setShow(true), 400) }}
      onMouseLeave={() => { clearTimeout(timer.current); setShow(false) }}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute', ...placements[placement],
          background: '#0F172A', color: '#fff', fontSize: 11, whiteSpace: 'nowrap',
          padding: '4px 8px', borderRadius: 4, pointerEvents: 'none', zIndex: 9999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)', display: 'flex', gap: 6, alignItems: 'center'
        }}>
          {label}
          {shortcut && (
            <span style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 3, padding: '1px 4px', fontSize: 10, fontFamily: 'monospace' }}>
              {shortcut}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
