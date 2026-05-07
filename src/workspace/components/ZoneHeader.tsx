import React from 'react'
import { Icon } from './Icon'

interface ZoneHeaderProps {
  label: string
  collapsed: boolean
  onToggle: () => void
  children?: React.ReactNode
}

export function ZoneHeader({ label, collapsed, onToggle, children }: ZoneHeaderProps) {
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div
        onClick={onToggle}
        style={{
          height: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingLeft: 12, paddingRight: 10, cursor: 'pointer', userSelect: 'none',
          background: 'var(--color-bg-elevated)', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text)' }}>
          {label}
        </span>
        <Icon name={collapsed ? 'chevronRight' : 'chevronDown'} size={14} color="var(--color-text-muted)" />
      </div>
      {!collapsed && children}
    </div>
  )
}
