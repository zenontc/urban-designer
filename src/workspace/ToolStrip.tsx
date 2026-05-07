import React, { useEffect } from 'react'
import { Icon } from './components/Icon'
import { Tooltip } from './components/Tooltip'
import { useUIStore, type ToolId } from '../store/uiStore'

const TOOLS = [
  { group: 'selection', tools: [
    { id: 'select' as ToolId, label: 'Select / Move', shortcut: 'V', icon: 'select' },
    { id: 'direct' as ToolId, label: 'Direct Select', shortcut: 'A', icon: 'directSelect' },
  ]},
  { group: 'drawing', tools: [
    { id: 'pen' as ToolId, label: 'Pen / Path', shortcut: 'P', icon: 'pen' },
    { id: 'line' as ToolId, label: 'Line', shortcut: 'L', icon: 'line' },
    { id: 'rect' as ToolId, label: 'Rectangle', shortcut: 'R', icon: 'rect' },
    { id: 'ellipse' as ToolId, label: 'Ellipse', shortcut: 'E', icon: 'ellipse' },
    { id: 'polygon' as ToolId, label: 'Polygon', shortcut: 'G', icon: 'polygon' },
  ]},
  { group: 'editing', tools: [
    { id: 'addNode' as ToolId, label: 'Add Node', shortcut: '+', icon: 'addNode' },
    { id: 'delNode' as ToolId, label: 'Delete Node', shortcut: '−', icon: 'deleteNode' },
    { id: 'scissors' as ToolId, label: 'Scissors', shortcut: 'C', icon: 'scissors' },
  ]},
  { group: 'annotation', tools: [
    { id: 'text' as ToolId, label: 'Text', shortcut: 'T', icon: 'text' },
    { id: 'dimension' as ToolId, label: 'Dimension', shortcut: 'X', icon: 'dimension' },
    { id: 'measure' as ToolId, label: 'Measure', shortcut: 'M', icon: 'measure' },
  ]},
  { group: 'view', tools: [
    { id: 'hand' as ToolId, label: 'Hand / Pan', shortcut: 'H', icon: 'hand' },
    { id: 'zoom' as ToolId, label: 'Zoom', shortcut: 'Z', icon: 'zoom' },
  ]},
]

const KEY_MAP: Record<string, ToolId> = {
  v: 'select', a: 'direct', p: 'pen', l: 'line', r: 'rect',
  e: 'ellipse', g: 'polygon', t: 'text', x: 'dimension',
  m: 'measure', h: 'hand', z: 'zoom', c: 'scissors',
}

export function ToolStrip() {
  const { activeTool, setActiveTool } = useUIStore()

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

  return (
    <div style={{
      width: 48, minWidth: 48, background: 'var(--color-bg-panel)',
      borderRight: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column', paddingTop: 6, paddingBottom: 6, zIndex: 10,
    }}>
      {TOOLS.map((group, gi) => (
        <React.Fragment key={group.group}>
          {gi > 0 && <div style={{ height: 1, background: 'var(--color-border)', margin: '6px 8px' }} />}
          {group.tools.map(tool => (
            <Tooltip key={tool.id} label={tool.label} shortcut={tool.shortcut}>
              <button
                onClick={() => setActiveTool(tool.id)}
                style={{
                  width: 36, height: 36, margin: '2px auto', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6, cursor: 'pointer', border: 'none',
                  background: activeTool === tool.id ? 'var(--color-accent-subtle)' : 'transparent',
                  borderLeft: activeTool === tool.id ? '2px solid var(--color-accent)' : '2px solid transparent',
                  color: activeTool === tool.id ? 'var(--color-accent)' : 'var(--color-text-sec)',
                  transition: 'all 100ms ease',
                }}
              >
                <Icon
                  name={tool.icon}
                  size={16}
                  color={activeTool === tool.id ? 'var(--color-accent)' : 'var(--color-text-sec)'}
                />
              </button>
            </Tooltip>
          ))}
        </React.Fragment>
      ))}
    </div>
  )
}
