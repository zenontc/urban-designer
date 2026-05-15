import React, { useState, useEffect, useCallback } from 'react'
import { TopBar } from '../workspace/TopBar'
import { ToolStrip } from '../workspace/ToolStrip'
import { StyleBar } from '../workspace/StyleBar'
import { Canvas } from '../workspace/Canvas'
import { RightPanel } from '../workspace/RightPanel'
import { ShadowPanel } from '../workspace/ShadowPanel'
import { ShareModal } from '../workspace/ShareModal'
import { AuthModal } from '../workspace/AuthModal'
import { CrossSectionEditor } from '../workspace/CrossSectionEditor'
import { ScaleBar } from '../workspace/ScaleBar'
import { PrintLayoutModal } from '../workspace/PrintLayoutModal'
import { ScenarioPanel } from '../workspace/ScenarioPanel'
import { ContextMenu } from '../workspace/ContextMenu'
import { ImportZone } from '../workspace/ImportZone'
import { LeftElementsPanel } from '../workspace/LeftElementsPanel'
import { useUIStore } from '../store/uiStore'
import { useAutoSave } from '../hooks/useAutoSave'

interface WorkspacePageProps {
  onNavigate: (page: string) => void
}

export function WorkspacePage({ onNavigate }: WorkspacePageProps) {
  const { nightMode, showShadowPanel, showShareModal, activeElementType } = useUIStore()
  const [showAuth, setShowAuth] = useState(false)
  const [showCrossSection, setShowCrossSection] = useState(false)
  const [showPrintLayout, setShowPrintLayout] = useState(false)
  const [showScenario, setShowScenario] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; featureId: string | null } | null>(null)

  useAutoSave()

  // Cross-section editor is now inline in DetailsZone — no floating panel trigger needed

  // Right-click context menu on canvas
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, featureId: null })
  }, [])

  // Print layout trigger via custom event from TopBar file menu
  useEffect(() => {
    function handler(e: CustomEvent) {
      if (e.detail === 'Print Layout…') setShowPrintLayout(true)
      if (e.detail === 'Scenario…') setShowScenario(true)
    }
    window.addEventListener('workspace-action', handler as EventListener)
    return () => window.removeEventListener('workspace-action', handler as EventListener)
  }, [])

  if (showPrintLayout) {
    return <PrintLayoutModal onClose={() => setShowPrintLayout(false)} />
  }

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: nightMode ? '#0A0F23' : 'var(--color-bg)',
    }}>
      <TopBar onNavigate={onNavigate} onAction={action => {
        if (action === 'Print Layout…') setShowPrintLayout(true)
        if (action === 'Scenario…') setShowScenario(true)
      }} />
      <StyleBar />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        <ToolStrip />
        <LeftElementsPanel />

        {/* Canvas + floating panels container */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          onContextMenu={handleContextMenu}>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <Canvas />
          <ImportZone />

          {/* Floating panels */}
          {showShadowPanel && <ShadowPanel />}
          {showScenario && <ScenarioPanel onClose={() => setShowScenario(false)} />}

          {/* Context menu */}
          {contextMenu && (
            <ContextMenu
              x={contextMenu.x} y={contextMenu.y}
              featureId={contextMenu.featureId}
              onClose={() => setContextMenu(null)}
            />
          )}

          {/* Keyboard hint strip */}
          <div style={{
            position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(15,23,42,0.7)', color: 'rgba(255,255,255,0.7)',
            borderRadius: 20, padding: '4px 14px', fontSize: 10,
            display: 'flex', gap: 12, alignItems: 'center', pointerEvents: 'none',
            backdropFilter: 'blur(6px)', zIndex: 10,
          }}>
            {[['V','Select'],['P','Pen'],['R','Rect'],['L','Line'],['T','Text'],['⌘Z','Undo']].map(([key, label]) => (
              <span key={key}>
                <kbd style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.15)', borderRadius: 3, padding: '1px 4px' }}>{key}</kbd> {label}
              </span>
            ))}
          </div>
          </div>
          <ScaleBar />
        </div>

        <RightPanel />
      </div>

      {/* Full-screen modal overlays */}
      {showShareModal && <ShareModal />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}
