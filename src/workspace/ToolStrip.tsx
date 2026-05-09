import React, { useEffect } from 'react'
import { Icon } from './components/Icon'
import { Tooltip } from './components/Tooltip'
import { useUIStore, type ToolId } from '../store/uiStore'

const TOOLS: Array<{ id: ToolId; label: string; shortcut: string; icon: string }[]> = [
  // Navigation
  [
    { id: 'pan',     label: 'Pan / Hand',     shortcut: 'H', icon: 'hand' },
    { id: 'select',  label: 'Select',          shortcut: 'V', icon: 'select' },
    { id: 'direct',  label: 'Marquee Select', shortcut: 'A', icon: 'marquee' },
  ],
  // Drawing
  [
    { id: 'pen',     label: 'Pen / Path',    shortcut: 'P', icon: 'penBezier' },
    { id: 'line',    label: 'Line',          shortcut: 'L', icon: 'line' },
    { id: 'rect',    label: 'Rectangle',     shortcut: 'R', icon: 'rect' },
    { id: 'ellipse', label: 'Ellipse',       shortcut: 'E', icon: 'ellipse' },
    { id: 'polygon', label: 'Polygon',       shortcut: 'G', icon: 'polygon' },
  ],
  // Edit
  [
    { id: 'text',    label: 'Text',          shortcut: 'T', icon: 'text' },
    { id: 'extrude', label: 'Extrude',       shortcut: 'X', icon: 'extrude' },
    { id: 'measure', label: 'Measure',       shortcut: 'M', icon: 'measure' },
  ],
]

const KEY_MAP: Record<string, ToolId> = {
  h: 'pan', v: 'select', a: 'direct', p: 'pen', l: 'line', r: 'rect',
  e: 'ellipse', g: 'polygon', t: 'text', x: 'extrude', m: 'measure',
}

export function ToolStrip() {
  const { activeTool, setActiveTool, showElementsPanel, toggleElementsPanel } = useUIStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const tool = KEY_MAP[e.key.toLowerCase()]
      if (tool) setActiveTool(tool)
      if (e.key === 'Escape') setActiveTool('select')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setActiveTool])

  function ToolBtn({ tool }: { tool: typeof TOOLS[0][0] }) {
    const active = activeTool === tool.id
    return (
      <Tooltip label={tool.label} shortcut={tool.shortcut}>
        <button
          onClick={() => setActiveTool(tool.id)}
          style={{
            width: 36, height: 36, margin: '1px auto', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, cursor: 'pointer', border: 'none',
            background: active ? 'var(--color-accent-subtle)' : 'transparent',
            color: active ? 'var(--color-accent)' : 'var(--color-text-sec)',
            transition: 'all 100ms ease',
            outline: active ? '1.5px solid var(--color-accent)' : 'none',
          }}
        >
          <Icon name={tool.icon} size={16} color={active ? 'var(--color-accent)' : 'var(--color-text-sec)'} />
        </button>
      </Tooltip>
    )
  }

  return (
    <div style={{
      width: 48, minWidth: 48, background: 'var(--color-bg-panel)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column', paddingTop: 6, paddingBottom: 6,
      gap: 0, zIndex: 10,
    }}>
      {/* Elements Library Toggle — top */}
      <Tooltip label="Elements Library" shortcut="Q">
        <button
          onClick={toggleElementsPanel}
          style={{
            width: 36, height: 36, margin: '2px auto 6px', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            borderRadius: 6, cursor: 'pointer', border: 'none',
            background: showElementsPanel ? 'var(--color-accent)' : 'transparent',
            color: showElementsPanel ? '#fff' : 'var(--color-text-sec)',
            transition: 'all 100ms ease',
          }}
          title="Elements Library"
        >
          <Icon name="elements" size={16} color={showElementsPanel ? '#fff' : 'var(--color-text-sec)'} />
        </button>
      </Tooltip>

      <div style={{ height: 1, background: 'var(--color-border)', margin: '0 8px 6px' }} />

      {TOOLS.map((group, gi) => (
        <React.Fragment key={gi}>
          {gi > 0 && <div style={{ height: 1, background: 'var(--color-border)', margin: '5px 8px' }} />}
          {group.map(tool => <ToolBtn key={tool.id} tool={tool} />)}
        </React.Fragment>
      ))}
    </div>
  )
}
