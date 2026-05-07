import React, { useRef, useState } from 'react'
import { Icon } from './components/Icon'
import { useProjectStore } from '../store/projectStore'
import { useMapStore } from '../store/mapStore'
import { useCanvasStore } from '../store/canvasStore'
import { ELEMENT_CATEGORIES } from '../elements/categories'
import { exportPDF } from '../utils/exportUtils'

const PAGE_SIZES = [
  { label: 'Letter (8.5×11")', w: 1100, h: 850 },
  { label: 'Tabloid (11×17")', w: 1700, h: 1100 },
  { label: 'A3 (297×420mm)',   w: 1587, h: 1123 },
  { label: 'A4 (210×297mm)',   w: 1123, h: 795 },
]

const SCALES = ['1" = 10\'', '1" = 20\'', '1" = 50\'', '1" = 100\'', '1" = 200\'', '1" = 500\'']

interface PrintLayoutModalProps {
  onClose: () => void
}

export function PrintLayoutModal({ onClose }: PrintLayoutModalProps) {
  const { projectName } = useProjectStore()
  const { zoom, rotation } = useMapStore()
  const { features } = useCanvasStore()
  const [pageSize, setPageSize] = useState(0)
  const [scale, setScale] = useState('1" = 100\'')
  const [showNorthArrow, setShowNorthArrow] = useState(true)
  const [showScaleBar, setShowScaleBar] = useState(true)
  const [showLegend, setShowLegend] = useState(true)
  const [showTitleBlock, setShowTitleBlock] = useState(true)
  const [title, setTitle] = useState(projectName)
  const [subtitle, setSubtitle] = useState('Urban Design Study')
  const [author, setAuthor] = useState('Urban Designer')
  const printRef = useRef<HTMLDivElement>(null)
  const page = PAGE_SIZES[pageSize]

  // Build legend from categories actually used
  const usedCategories = Array.from(new Set(features.map(f => f.properties.category)))
  const legendItems = ELEMENT_CATEGORIES.filter(c => usedCategories.includes(c.id) || usedCategories.includes(c.label)).slice(0, 10)

  async function handlePrint() {
    const el = printRef.current
    if (el) await exportPDF(el, title)
  }

  function handleBrowserPrint() {
    window.print()
  }

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', background: '#F1F5F9' }}>
      {/* Toolbar */}
      <div style={{ height: 52, background: 'var(--color-bg-panel)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0 }}>
        <button onClick={onClose} style={{ height: 32, padding: '0 12px', fontSize: 12, fontWeight: 500, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-sec)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="chevronLeft" size={14} /> Back
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>Print Layout</span>
        <div style={{ flex: 1 }} />

        {/* Options */}
        <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))} style={{ height: 30, padding: '0 8px', fontSize: 12, borderRadius: 5, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text)' }}>
          {PAGE_SIZES.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
        </select>
        <select value={scale} onChange={e => setScale(e.target.value)} style={{ height: 30, padding: '0 8px', fontSize: 12, borderRadius: 5, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text)' }}>
          {SCALES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { label: 'N Arrow', val: showNorthArrow, set: setShowNorthArrow },
            { label: 'Scale Bar', val: showScaleBar, set: setShowScaleBar },
            { label: 'Legend', val: showLegend, set: setShowLegend },
            { label: 'Title', val: showTitleBlock, set: setShowTitleBlock },
          ].map(opt => (
            <button key={opt.label} onClick={() => opt.set(!opt.val)} style={{ height: 28, padding: '0 8px', fontSize: 11, fontWeight: opt.val ? 600 : 400, borderRadius: 4, border: `1px solid ${opt.val ? 'var(--color-accent)' : 'var(--color-border)'}`, background: opt.val ? 'var(--color-accent-subtle)' : 'transparent', color: opt.val ? 'var(--color-accent)' : 'var(--color-text-sec)', cursor: 'pointer' }}>
              {opt.label}
            </button>
          ))}
        </div>

        <button onClick={handlePrint} style={{ height: 32, padding: '0 14px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="download" size={14} color="#fff" /> Export PDF
        </button>
        <button onClick={handleBrowserPrint} style={{ height: 32, padding: '0 14px', fontSize: 13, fontWeight: 500, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-sec)', cursor: 'pointer' }}>
          Print…
        </button>
      </div>

      {/* Page preview */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 32 }}>
        <div ref={printRef} style={{
          width: page.w, height: page.h, background: '#fff', position: 'relative',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)', flexShrink: 0, overflow: 'hidden',
          fontFamily: 'Inter, sans-serif',
        }}>
          {/* Map area placeholder */}
          <div style={{ position: 'absolute', top: 16, left: 16, right: showLegend ? 200 : 16, bottom: showTitleBlock ? 80 : 16, background: '#E8EEF4', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #CBD5E1' }}>
            <div style={{ textAlign: 'center', color: '#94A3B8' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗺</div>
              <div style={{ fontSize: 13 }}>Map view ({zoom.toFixed(1)}× zoom)</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>{features.length} feature{features.length !== 1 ? 's' : ''}</div>
            </div>
          </div>

          {/* North arrow */}
          {showNorthArrow && (
            <div style={{ position: 'absolute', top: 28, right: showLegend ? 212 : 28 }}>
              <svg width="36" height="36" viewBox="0 0 36 36" style={{ transform: `rotate(${-rotation}deg)` }}>
                <polygon points="18,2 22,18 18,14 14,18" fill="#1E293B" />
                <polygon points="18,34 22,18 18,22 14,18" fill="#94A3B8" />
                <circle cx="18" cy="18" r="3" fill="#1E293B" />
              </svg>
              <div style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#1E293B', marginTop: 1 }}>N</div>
            </div>
          )}

          {/* Scale bar */}
          {showScaleBar && (
            <div style={{ position: 'absolute', bottom: showTitleBlock ? 96 : 20, left: 28 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0 }}>
                {[0, 1, 2, 3, 4].map(i => (
                  <div key={i} style={{ width: 20, height: i % 2 === 0 ? 8 : 4, background: i % 2 === 0 ? '#1E293B' : '#94A3B8', border: '0.5px solid #1E293B' }} />
                ))}
              </div>
              <div style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>Scale: {scale}</div>
            </div>
          )}

          {/* Legend */}
          {showLegend && (
            <div style={{ position: 'absolute', top: 16, right: 16, width: 172, background: 'rgba(255,255,255,0.95)', border: '1px solid #CBD5E1', borderRadius: 4, padding: '8px 10px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#475569', marginBottom: 6 }}>Legend</div>
              {legendItems.length > 0 ? legendItems.map(cat => (
                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 12, height: 12, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: '#334155' }}>{cat.label}</span>
                </div>
              )) : (
                <div style={{ fontSize: 9, color: '#94A3B8' }}>Draw elements to populate legend</div>
              )}
            </div>
          )}

          {/* Title block */}
          {showTitleBlock && (
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 76, background: '#1E293B', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ width: 44, height: 44, background: '#A3B57A', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 16, flexShrink: 0, fontFamily: "'Inter Tight', sans-serif" }}>UD</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{title}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{subtitle}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#64748B' }}>{author}</div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{dateStr}</div>
                <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>Scale: {scale}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title editor */}
      <div style={{ height: 48, background: 'var(--color-bg-panel)', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>Title</span>
        <input value={title} onChange={e => setTitle(e.target.value)} style={{ height: 28, padding: '0 8px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none', width: 200 }} />
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>Subtitle</span>
        <input value={subtitle} onChange={e => setSubtitle(e.target.value)} style={{ height: 28, padding: '0 8px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none', width: 200 }} />
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>Author</span>
        <input value={author} onChange={e => setAuthor(e.target.value)} style={{ height: 28, padding: '0 8px', fontSize: 12, borderRadius: 4, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none', width: 160 }} />
      </div>
    </div>
  )
}
