import React, { useState } from 'react'
import { useUIStore } from '../../store/uiStore'
import { ELEMENT_CATEGORIES } from '../../elements/categories'
import type { ElementTypeDefinition } from '../../elements/types'

// ── Thumbnail renderers ────────────────────────────────────────────────────

function hex(color: string, alpha: number) {
  if (!color?.startsWith('#') || color.length < 7) return `rgba(107,114,128,${alpha})`
  const r = parseInt(color.slice(1, 3), 16)
  const g = parseInt(color.slice(3, 5), 16)
  const b = parseInt(color.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function TilePreview({ el }: { el: ElementTypeDefinition }) {
  const strokeC = el.defaultStyle.strokeColor ?? el.color ?? '#6B7280'
  const fillC = el.defaultStyle.fillColor ?? strokeC
  const sw = el.defaultStyle.strokeWidth ?? 1.5
  const cat = el.category
  const id = el.id

  // ── Surfaces ─ plan-view fill with material texture ──────────────────────
  if (cat === 'surfaces') {
    const bg = fillC
    // Brick / cobble: brick-course pattern
    if (id.includes('brick') || id.includes('cobble')) {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill={bg} />
          {[4, 12, 20, 28, 36].map((y, i) => (
            <g key={y}>
              {[i % 2 === 0 ? 4 : 0, i % 2 === 0 ? 14 : 10, i % 2 === 0 ? 24 : 20, i % 2 === 0 ? 34 : 30, i % 2 === 0 ? 44 : 40].map(x => (
                <rect key={x} x={x} y={y} width="9" height="6" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.5" />
              ))}
            </g>
          ))}
        </svg>
      )
    }
    // Gravel / decomposed granite: dotted
    if (id.includes('gravel') || id.includes('decomposed') || id.includes('dirt') || id.includes('unpaved')) {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill={bg} />
          {[8, 15, 22, 29, 36].flatMap(y =>
            [6, 13, 20, 27, 34, 41].map(x => (
              <circle key={`${x}-${y}`} cx={x + (y % 14 === 8 ? 3 : 0)} cy={y} r="1.2" fill="rgba(0,0,0,0.25)" />
            ))
          )}
        </svg>
      )
    }
    // Permeable / turf-grid: grid pattern
    if (id.includes('permeable') || id.includes('turf-grid') || id.includes('grass-paving')) {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill={bg} />
          {[4, 12, 20, 28, 36].map(x => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="44" stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" />
          ))}
          {[4, 12, 20, 28, 36].map(y => (
            <line key={`h${y}`} x1="0" y1={y} x2="44" y2={y} stroke="rgba(0,0,0,0.2)" strokeWidth="0.6" />
          ))}
        </svg>
      )
    }
    // Rubber: concentric arc texture
    if (id.includes('rubber')) {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill={bg} />
          {[6, 12, 18, 24].map(r => (
            <circle key={r} cx="44" cy="44" r={r * 2} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
          ))}
        </svg>
      )
    }
    // Colored paint: flat fill with slight gloss
    if (id.includes('paint')) {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill={bg} />
          <rect x="0" y="0" width="44" height="12" rx="4" fill="rgba(255,255,255,0.12)" />
        </svg>
      )
    }
    // Default surface: flat fill
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={bg} />
        <rect x="0" y="0" width="44" height="8" rx="4" fill="rgba(255,255,255,0.08)" />
      </svg>
    )
  }

  // ── Street sections ─ plan-view road ─────────────────────────────────────
  if (cat === 'streets') {
    const roadW = id === 'highway' ? 26 : id === 'arterial' ? 22 : id === 'collector-street' ? 18 : id === 'alley' ? 10 : 16
    const y1 = (44 - roadW) / 2
    const y2 = y1 + roadW
    const hasMedian = id === 'arterial' || id === 'highway'
    const isBike = id === 'bike-lane'
    const isPed = id === 'ped-street'
    const isShared = id === 'shared-path'
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#4B5563" />
        <rect x="0" y={y1} width="44" height={roadW} fill={isBike ? '#052E16' : isPed || isShared ? '#374151' : '#1F2937'} />
        {hasMedian && <rect x="0" y={22 - 2} width="44" height="4" fill="#374151" />}
        <line x1="0" y1={y1} x2="44" y2={y1} stroke="#9CA3AF" strokeWidth="0.8" />
        <line x1="0" y1={y2} x2="44" y2={y2} stroke="#9CA3AF" strokeWidth="0.8" />
        {isBike
          ? <line x1="0" y1="22" x2="44" y2="22" stroke="#16A34A" strokeWidth="1.5" strokeDasharray="6 3" />
          : isPed || isShared
            ? <line x1="0" y1="22" x2="44" y2="22" stroke="#D1D5DB" strokeWidth="0.8" strokeDasharray="4 3" />
            : <line x1="0" y1="22" x2="44" y2="22" stroke="#FBBF24" strokeWidth="0.8" strokeDasharray="5 4" />}
      </svg>
    )
  }

  // ── Markings & Signage ─────────────────────────────────────────────────
  if (cat === 'markings') {
    if (id.includes('crosswalk') || id.includes('crossing') || id === 'std-crosswalk' || id === 'continental-crosswalk') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          {[5, 10, 15, 20, 25, 30, 35].map(x => (
            <rect key={x} x={x} y="10" width="3.5" height="24" fill="white" opacity="0.9" rx="0.5" />
          ))}
        </svg>
      )
    }
    if (id.includes('arrow') || id === 'direction-arrow' || id === 'left-turn-arrow' || id === 'right-turn-arrow') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <line x1="22" y1="8" x2="22" y2="30" stroke="white" strokeWidth="3" strokeLinecap="round" />
          <polygon points="14,26 22,38 30,26" fill="white" />
        </svg>
      )
    }
    if (id.includes('stop-sign') || id === 'yield-sign') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <polygon points="22,6 31,10 36,19 36,25 31,34 22,38 13,34 8,25 8,19 13,10" fill="#DC2626" />
          <text x="22" y="26" textAnchor="middle" fontSize="8" fontWeight="900" fill="white" fontFamily="sans-serif">STOP</text>
        </svg>
      )
    }
    if (id.includes('sign')) {
      const sc = el.defaultStyle.fillColor ?? '#16A34A'
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <rect x="8" y="13" width="28" height="14" rx="2" fill={sc} />
          <line x1="22" y1="27" x2="22" y2="38" stroke="#9CA3AF" strokeWidth="1.5" />
          <rect x="8" y="13" width="28" height="4" rx="2" fill="rgba(255,255,255,0.15)" />
        </svg>
      )
    }
    if (id.includes('signal') || id === 'traffic-signal') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <rect x="16" y="6" width="12" height="26" rx="3" fill="#111827" />
          <circle cx="22" cy="12" r="3.5" fill="#DC2626" />
          <circle cx="22" cy="21" r="3.5" fill="#FBBF24" opacity="0.4" />
          <circle cx="22" cy="30" r="3.5" fill="#16A34A" opacity="0.4" />
          <line x1="22" y1="32" x2="22" y2="38" stroke="#6B7280" strokeWidth="1.5" />
        </svg>
      )
    }
    if (id.includes('sharrow') || id.includes('bike-stencil')) {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <ellipse cx="22" cy="26" rx="6" ry="4" fill="none" stroke="#16A34A" strokeWidth="1.5" />
          <circle cx="22" cy="14" r="3" fill="none" stroke="#16A34A" strokeWidth="1.5" />
          <line x1="16" y1="21" x2="28" y2="21" stroke="#16A34A" strokeWidth="1.5" />
          <polyline points="18,7 22,4 26,7" fill="none" stroke="#16A34A" strokeWidth="1.5" />
        </svg>
      )
    }
    // Default marking — colored line on road
    const lineColor = el.defaultStyle.strokeColor ?? '#FFFFFF'
    const dash = el.defaultStyle.lineType === 'dashed' ? '5 4' : undefined
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#374151" />
        <line x1="6" y1="22" x2="38" y2="22" stroke={lineColor} strokeWidth={Math.max(sw * 1.5, 2)} strokeLinecap="round" strokeDasharray={dash} />
      </svg>
    )
  }

  // ── Crosswalks ─────────────────────────────────────────────────────────
  if (cat === 'crosswalks') {
    if (id === 'std-crosswalk' || id === 'continental-crosswalk' || id === 'raised-crosswalk') {
      const isRaised = id === 'raised-crosswalk'
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill={isRaised ? '#9CA3AF' : '#374151'} />
          {[5, 10, 15, 20, 25, 30, 35].map(x => (
            <rect key={x} x={x} y="10" width="3.5" height="24" fill="white" opacity={isRaised ? 0.6 : 0.9} rx="0.5" />
          ))}
        </svg>
      )
    }
    // Refuge island / curb extension: plan-view concrete blob
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#374151" />
        <ellipse cx="22" cy="22" rx="10" ry="6" fill="#D1D5DB" />
        <ellipse cx="22" cy="22" rx="10" ry="6" fill="none" stroke="#9CA3AF" strokeWidth="1" />
      </svg>
    )
  }

  // ── Parking ────────────────────────────────────────────────────────────
  if (cat === 'parking') {
    if (id === 'surface-lot' || id === 'parking-deck-bldg') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill={fillC} />
          {[8, 16, 24, 32].map(x => (
            <line key={x} x1={x} y1="4" x2={x} y2="40" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
          ))}
          <text x="22" y="27" textAnchor="middle" fontSize="16" fontWeight="700" fill="rgba(255,255,255,0.6)" fontFamily="sans-serif">P</text>
        </svg>
      )
    }
    // Parallel / head-in / diagonal: stall lines
    const isParallel = id === 'parallel-parking'
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#1F2937" />
        <rect x="0" y="14" width="44" height="16" fill="#374151" />
        {isParallel
          ? [8, 20, 32].map(x => <line key={x} x1={x} y1="14" x2={x} y2="30" stroke="white" strokeWidth="0.75" opacity="0.6" />)
          : [6, 16, 26, 36].map(x => <line key={x} x1={x} y1="30" x2={x + 4} y2="14" stroke="white" strokeWidth="0.75" opacity="0.6" />)
        }
      </svg>
    )
  }

  // ── Transit ────────────────────────────────────────────────────────────
  if (cat === 'transit') {
    if (id === 'bus-route' || id === 'bus-only-lane' || id === 'rail-track') {
      const tc = el.defaultStyle.strokeColor ?? '#DC2626'
      const dash = id === 'rail-track' ? undefined : undefined
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#1E293B" />
          <line x1="4" y1="22" x2="40" y2="22" stroke={tc} strokeWidth={Math.max(sw * 1.5, 3)} strokeLinecap="round" strokeDasharray={dash} />
          {id === 'rail-track' && [8, 16, 24, 32, 40].map(x => (
            <line key={x} x1={x - 2} y1="17" x2={x - 2} y2="27" stroke="#374151" strokeWidth="2.5" />
          ))}
        </svg>
      )
    }
    // Stations: point symbol
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#1E293B" />
        <circle cx="22" cy="22" r="10" fill={hex(fillC.startsWith('#') ? fillC : '#2563EB', 0.3)} />
        <circle cx="22" cy="22" r="10" fill="none" stroke={fillC.startsWith('#') ? fillC : '#2563EB'} strokeWidth="2" />
        <circle cx="22" cy="22" r="4" fill={fillC.startsWith('#') ? fillC : '#2563EB'} />
      </svg>
    )
  }

  // ── Paths ──────────────────────────────────────────────────────────────
  if (cat === 'paths') {
    if (id === 'ada-ramp') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#4B5563" />
          <polygon points="4,36 40,36 40,12" fill="#D1D5DB" opacity="0.8" />
          <line x1="4" y1="36" x2="40" y2="12" stroke="#9CA3AF" strokeWidth="1" />
        </svg>
      )
    }
    const dash = el.defaultStyle.lineType === 'dashed' ? '6 4' : undefined
    const pc = el.defaultStyle.strokeColor ?? '#D1D5DB'
    const pathW = id === 'multi-path' ? 6 : 3
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#4B5563" />
        <line x1="6" y1="34" x2="20" y2="22" stroke={pc} strokeWidth={pathW} strokeLinecap="round" />
        <line x1="20" y1="22" x2="38" y2="14" stroke={pc} strokeWidth={pathW} strokeLinecap="round" strokeDasharray={dash} />
      </svg>
    )
  }

  // ── Street Furniture ───────────────────────────────────────────────────
  if (cat === 'furniture') {
    if (id === 'street-light' || id === 'ped-light' || id === 'accent-light') {
      const glow = id === 'accent-light' ? 10 : id === 'ped-light' ? 14 : 18
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#111827" />
          <circle cx="22" cy="20" r={glow} fill="rgba(252,211,77,0.15)" />
          <circle cx="22" cy="20" r={glow * 0.55} fill="rgba(252,211,77,0.25)" />
          <circle cx="22" cy="20" r="3.5" fill="#FCD34D" />
          <line x1="22" y1="24" x2="22" y2="36" stroke="#4B5563" strokeWidth="1.5" />
        </svg>
      )
    }
    if (id === 'string-lights') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#111827" />
          <path d="M4,14 Q11,22 18,18 Q25,14 32,20 Q39,26 42,22" fill="none" stroke="#FCD34D" strokeWidth="1" />
          {[8, 16, 24, 32].map(x => (
            <circle key={x} cx={x} cy={x % 16 === 8 ? 19 : 21} r="2" fill="rgba(252,211,77,0.8)" />
          ))}
        </svg>
      )
    }
    if (id === 'bench' || id === 'table-chairs' || id === 'picnic-table') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <rect x="10" y="18" width="24" height="8" rx="2" fill="#92400E" opacity="0.9" />
          <line x1="14" y1="26" x2="14" y2="32" stroke="#78716C" strokeWidth="1.5" />
          <line x1="30" y1="26" x2="30" y2="32" stroke="#78716C" strokeWidth="1.5" />
          {id !== 'bench' && <rect x="6" y="22" width="32" height="3" rx="1" fill="#9CA3AF" opacity="0.5" />}
        </svg>
      )
    }
    if (id === 'bollard' || id === 'jersey-barrier' || id === 'bollard-planter') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          {id === 'jersey-barrier'
            ? [8, 16, 24, 32].map(x => <rect key={x} x={x} y="16" width="5" height="12" rx="2.5" fill="#9CA3AF" />)
            : [10, 22, 34].map(x => <circle key={x} cx={x} cy="24" r="4" fill={fillC} />)
          }
        </svg>
      )
    }
    if (id === 'bike-rack' || id === 'bike-share' || id === 'bike-corral') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <ellipse cx="14" cy="26" rx="7" ry="7" fill="none" stroke="#64748B" strokeWidth="2" />
          <ellipse cx="30" cy="26" rx="7" ry="7" fill="none" stroke="#64748B" strokeWidth="2" />
          <line x1="14" y1="19" x2="24" y2="16" stroke="#64748B" strokeWidth="1.5" />
          <line x1="24" y1="16" x2="30" y2="19" stroke="#64748B" strokeWidth="1.5" />
          <line x1="14" y1="19" x2="14" y2="26" stroke="#64748B" strokeWidth="1.5" />
        </svg>
      )
    }
    if (id === 'fountain') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <circle cx="22" cy="22" r="14" fill="none" stroke="#3B82F6" strokeWidth="1.5" />
          <circle cx="22" cy="22" r="8" fill={hex('#3B82F6', 0.3)} />
          <circle cx="22" cy="22" r="4" fill="#3B82F6" opacity="0.8" />
          {[0, 72, 144, 216, 288].map(deg => {
            const rad = Math.PI * deg / 180
            return <line key={deg} x1="22" y1="22" x2={22 + 12 * Math.cos(rad)} y2={22 + 12 * Math.sin(rad)} stroke="#93C5FD" strokeWidth="0.5" opacity="0.5" />
          })}
        </svg>
      )
    }
    if (id === 'playground') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <rect x="6" y="6" width="32" height="32" rx="3" fill={hex('#FCD34D', 0.3)} stroke="#FBBF24" strokeWidth="1" />
          <circle cx="14" cy="17" r="4" fill="#F97316" opacity="0.8" />
          <rect x="20" y="22" width="10" height="8" rx="1" fill="#3B82F6" opacity="0.7" />
          <line x1="14" y1="28" x2="14" y2="36" stroke="#78716C" strokeWidth="1.5" />
        </svg>
      )
    }
    if (id === 'sports-court') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <rect x="4" y="10" width="36" height="24" fill="#1F2937" stroke="#94A3B8" strokeWidth="1" />
          <line x1="22" y1="10" x2="22" y2="34" stroke="#94A3B8" strokeWidth="0.75" />
          <ellipse cx="22" cy="22" rx="6" ry="8" fill="none" stroke="#94A3B8" strokeWidth="0.75" />
        </svg>
      )
    }
    if (id === 'community-garden' || id === 'dog-park') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <rect x="4" y="4" width="36" height="36" rx="3" fill={hex(fillC, 0.5)} stroke={fillC} strokeWidth="1" />
          {id === 'community-garden' && [10, 22, 34].map(x =>
            [10, 24, 36].map(y => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" fill="#16A34A" opacity="0.8" />
            ))
          )}
        </svg>
      )
    }
    if (id === 'pergola') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <rect x="6" y="6" width="32" height="32" fill="none" stroke="#92400E" strokeWidth="1.5" />
          {[12, 18, 24, 30].map(x => (
            <line key={`v${x}`} x1={x} y1="6" x2={x} y2="38" stroke="#92400E" strokeWidth="0.75" opacity="0.5" />
          ))}
          {[12, 18, 24, 30].map(y => (
            <line key={`h${y}`} x1="6" y1={y} x2="38" y2={y} stroke="#92400E" strokeWidth="0.75" opacity="0.5" />
          ))}
        </svg>
      )
    }
    if (id === 'public-art' || id === 'monument') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <circle cx="22" cy="22" r="12" fill={hex(fillC, 0.15)} stroke={fillC} strokeWidth="1.5" />
          <polygon points="22,10 27,19 38,19 29,25 32,36 22,30 12,36 15,25 6,19 17,19" fill={fillC} opacity="0.6" />
        </svg>
      )
    }
    // Generic furniture point
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#374151" />
        <circle cx="22" cy="22" r="10" fill={hex(fillC, 0.25)} stroke={fillC} strokeWidth="1.5" />
        <circle cx="22" cy="22" r="4" fill={fillC} opacity="0.85" />
      </svg>
    )
  }

  // ── Utilities ──────────────────────────────────────────────────────────
  if (cat === 'utilities') {
    if (id === 'fire-hydrant') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <rect x="17" y="14" width="10" height="16" rx="2" fill="#DC2626" />
          <rect x="13" y="20" width="18" height="6" rx="1" fill="#B91C1C" />
          <rect x="19" y="30" width="6" height="6" rx="1" fill="#DC2626" />
          <circle cx="22" cy="18" r="3" fill="#FCA5A5" opacity="0.5" />
        </svg>
      )
    }
    if (id.includes('light') || id.includes('lamp')) {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#111827" />
          <circle cx="22" cy="20" r="16" fill="rgba(252,211,77,0.1)" />
          <circle cx="22" cy="20" r="3.5" fill="#FCD34D" />
          <line x1="22" y1="24" x2="22" y2="36" stroke="#4B5563" strokeWidth="1.5" />
        </svg>
      )
    }
    if (id === 'utility-pole' || id === 'cell-tower') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <line x1="22" y1="6" x2="22" y2="38" stroke="#64748B" strokeWidth="2" />
          <line x1="10" y1="14" x2="34" y2="14" stroke="#64748B" strokeWidth="1.5" />
          <line x1="12" y1="22" x2="32" y2="22" stroke="#64748B" strokeWidth="1.5" />
          <line x1="10" y1="14" x2="22" y2="38" stroke="#64748B" strokeWidth="0.75" opacity="0.4" />
          <line x1="34" y1="14" x2="22" y2="38" stroke="#64748B" strokeWidth="0.75" opacity="0.4" />
        </svg>
      )
    }
    if (id.includes('pipe') || id.includes('line') || id === 'storm-pipe' || id === 'power-line' || id === 'underground-util') {
      const uc = el.defaultStyle.strokeColor ?? '#3B82F6'
      const udash = el.defaultStyle.lineType === 'dashed' ? '6 3' : undefined
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#1E293B" />
          <line x1="4" y1="22" x2="40" y2="22" stroke={uc} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={udash} />
          {!udash && <line x1="4" y1="22" x2="40" y2="22" stroke="rgba(255,255,255,0.1)" strokeWidth="4" strokeLinecap="round" />}
        </svg>
      )
    }
    if (id === 'manhole' || id === 'catch-basin' || id === 'transformer' || id === 'storm-outfall') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <circle cx="22" cy="22" r="10" fill="#1F2937" stroke="#6B7280" strokeWidth="1.5" />
          <line x1="22" y1="12" x2="22" y2="32" stroke="#4B5563" strokeWidth="1" />
          <line x1="12" y1="22" x2="32" y2="22" stroke="#4B5563" strokeWidth="1" />
          <circle cx="22" cy="22" r="3" fill="#374151" stroke="#6B7280" strokeWidth="1" />
        </svg>
      )
    }
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#374151" />
        <circle cx="22" cy="22" r="8" fill={hex(fillC, 0.2)} stroke={fillC} strokeWidth="1.5" />
        <circle cx="22" cy="22" r="3.5" fill={fillC} opacity="0.8" />
      </svg>
    )
  }

  // ── Landscape ──────────────────────────────────────────────────────────
  if (cat === 'landscape') {
    if (id === 'water' || id === 'wetland' || id === 'retention-basin') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill={fillC} />
          <path d="M4,18 Q11,14 18,18 Q25,22 32,18 Q39,14 42,18" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
          <path d="M4,26 Q11,22 18,26 Q25,30 32,26 Q39,22 42,26" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
        </svg>
      )
    }
    if (id === 'beach' || id === 'rock') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill={fillC} />
          {id === 'beach'
            ? [6, 14, 22, 30, 38].flatMap(x => [8, 20, 32].map(y => (
                <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="rgba(161,110,30,0.3)" />
              )))
            : [8, 20, 32].map((x, i) => (
                <ellipse key={x} cx={x + i * 2} cy={20 + i * 4} rx={6 + i} ry={4 + i} fill={hex('#9CA3AF', 0.5)} stroke="#6B7280" strokeWidth="0.5" />
              ))
          }
        </svg>
      )
    }
    // Lawn/meadow/forest/agricultural: flat fill + optional texture
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={fillC} />
        {(id === 'forest' || id === 'meadow') && [8, 18, 28, 36].map((x, i) => (
          <circle key={x} cx={x} cy={14 + (i % 2) * 8} r={id === 'forest' ? 5 : 3} fill="rgba(0,0,0,0.15)" />
        ))}
        <rect x="0" y="0" width="44" height="8" rx="4" fill="rgba(255,255,255,0.1)" />
      </svg>
    )
  }

  // ── Planting ───────────────────────────────────────────────────────────
  if (cat === 'planting') {
    if (id === 'tree' || id === 'shrub') {
      const r = id === 'tree' ? 12 : 8
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#1A2E1A" />
          <circle cx="22" cy="20" r={r} fill={fillC} opacity="0.9" />
          <circle cx="22" cy="20" r={r} fill="none" stroke={hex(fillC, 0.6)} strokeWidth="1" />
          {[0, 60, 120, 180, 240, 300].map(deg => {
            const rad = Math.PI * deg / 180
            const rr = r * 0.65
            return <line key={deg} x1="22" y1="20" x2={22 + rr * Math.cos(rad)} y2={20 + rr * Math.sin(rad)} stroke="rgba(0,0,0,0.2)" strokeWidth="0.75" />
          })}
          <circle cx="22" cy="20" r="2.5" fill="rgba(255,255,255,0.2)" />
          {id === 'tree' && <line x1="22" y1="32" x2="22" y2="38" stroke="#78350F" strokeWidth="1.5" />}
        </svg>
      )
    }
    if (id === 'street-tree') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#1A2E1A" />
          {[8, 22, 36].map(x => (
            <g key={x}>
              <circle cx={x} cy="18" r="7" fill={strokeC} opacity="0.85" />
              <line x1={x} y1="25" x2={x} y2="36" stroke="#78350F" strokeWidth="1.2" />
            </g>
          ))}
        </svg>
      )
    }
    if (id === 'hedge' || id === 'espalier') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#1A2E1A" />
          <rect x="4" y="14" width="36" height="16" rx="4" fill={strokeC} opacity="0.85" />
          {[10, 18, 26, 34].map(x => (
            <circle key={x} cx={x} cy="22" r="4" fill={hex(strokeC, 0.3)} />
          ))}
        </svg>
      )
    }
    if (id === 'vine') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#1A2E1A" />
          <path d="M6,36 C10,24 16,20 22,22 C28,24 34,20 38,8" fill="none" stroke={el.defaultStyle.strokeColor ?? '#4ADE80'} strokeWidth="2" strokeLinecap="round" />
          {[12, 22, 32].map(x => (
            <circle key={x} cx={x} cy={36 - x * 0.6} r="2.5" fill="#4ADE80" opacity="0.7" />
          ))}
        </svg>
      )
    }
    if (id === 'green-roof') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <rect x="4" y="4" width="36" height="36" rx="2" fill={hex(fillC, 0.7)} />
          {[8, 16, 24, 32].map(x =>
            [8, 20, 32].map(y => (
              <circle key={`${x}-${y}`} cx={x + (y % 20 === 8 ? 4 : 0)} cy={y} r="2.5" fill={hex('#15803D', 0.7)} />
            ))
          )}
        </svg>
      )
    }
    // Generic planting polygon
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#1A2E1A" />
        <rect x="4" y="4" width="36" height="36" rx="3" fill={hex(fillC, 0.7)} stroke={fillC} strokeWidth="1" />
        {[10, 20, 30].flatMap(x => [10, 22, 34].map(y => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2" fill={hex('#15803D', 0.4)} />
        )))}
      </svg>
    )
  }

  // ── Green Infrastructure ───────────────────────────────────────────────
  if (cat === 'green-infra') {
    if (id === 'storm-tree-pit') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <circle cx="22" cy="22" r="12" fill={hex('#16A34A', 0.3)} stroke="#16A34A" strokeWidth="1.5" />
          <circle cx="22" cy="22" r="7" fill={hex('#22C55E', 0.6)} />
          <circle cx="22" cy="22" r="3" fill="#15803D" />
        </svg>
      )
    }
    // Bioswale / rain garden: water + vegetation
    const isWet = id === 'rain-garden' || id === 'constructed-wetland' || id === 'retention-basin'
    const wc = isWet ? '#22D3EE' : '#4ADE80'
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={hex(fillC, 0.8)} />
        <path d="M6,30 Q11,20 16,26 Q21,32 26,22 Q31,12 38,18" fill="none" stroke={wc} strokeWidth="1.5" opacity="0.7" />
        {[10, 20, 30].map(x => (
          <line key={x} x1={x} y1="26" x2={x - 2} y2="18" stroke="#16A34A" strokeWidth="1.2" strokeLinecap="round" />
        ))}
      </svg>
    )
  }

  // ── Actors ─────────────────────────────────────────────────────────────
  if (cat === 'actors') {
    if (id === 'car' || id === 'delivery-vehicle' || id === 'bus-vehicle') {
      const carC = fillC
      const isLong = id === 'bus-vehicle' || id === 'delivery-vehicle'
      const cw = isLong ? 30 : 22
      const ch = isLong ? 12 : 14
      const cx = (44 - cw) / 2
      const cy = (44 - ch) / 2
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <rect x={cx} y={cy} width={cw} height={ch} rx="3" fill={carC} opacity="0.9" />
          <circle cx={cx + 4} cy={cy + ch} r="3.5" fill="#1F2937" />
          <circle cx={cx + cw - 4} cy={cy + ch} r="3.5" fill="#1F2937" />
          {isLong && <circle cx={cx + cw / 2} cy={cy + ch} r="3.5" fill="#1F2937" />}
          <rect x={cx + 2} y={cy + 2} width={cw - 4} height={ch * 0.45} rx="1.5" fill="rgba(255,255,255,0.3)" />
        </svg>
      )
    }
    if (id === 'bicyclist' || id === 'scooter-rider') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <circle cx="15" cy="28" r="7" fill="none" stroke={fillC} strokeWidth="2" />
          <circle cx="29" cy="28" r="7" fill="none" stroke={fillC} strokeWidth="2" />
          <line x1="15" y1="21" x2="22" y2="14" stroke={fillC} strokeWidth="1.5" />
          <line x1="22" y1="14" x2="29" y2="21" stroke={fillC} strokeWidth="1.5" />
          <circle cx="22" cy="12" r="3.5" fill={fillC} opacity="0.8" />
        </svg>
      )
    }
    if (id === 'wheelchair-user') {
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#374151" />
          <circle cx="22" cy="12" r="4" fill={fillC} opacity="0.8" />
          <line x1="22" y1="16" x2="22" y2="26" stroke={fillC} strokeWidth="2" strokeLinecap="round" />
          <line x1="22" y1="22" x2="30" y2="22" stroke={fillC} strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="32" r="7" fill="none" stroke={fillC} strokeWidth="2" />
        </svg>
      )
    }
    // Default pedestrian / actor
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#374151" />
        <circle cx="22" cy="12" r="4.5" fill={fillC} opacity="0.85" />
        <line x1="22" y1="17" x2="22" y2="29" stroke={fillC} strokeWidth="2" strokeLinecap="round" />
        <line x1="14" y1="22" x2="30" y2="22" stroke={fillC} strokeWidth="2" strokeLinecap="round" />
        <line x1="22" y1="29" x2="16" y2="38" stroke={fillC} strokeWidth="2" strokeLinecap="round" />
        <line x1="22" y1="29" x2="28" y2="38" stroke={fillC} strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  // ── Annotations ────────────────────────────────────────────────────────
  if (cat === 'annotations') {
    if (id === 'site-boundary' || id === 'phase-boundary') {
      const bc = el.defaultStyle.strokeColor ?? '#F97316'
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#1E293B" />
          <rect x="6" y="6" width="32" height="32" rx="2" fill="none" stroke={bc} strokeWidth="1.5" strokeDasharray="5 3" />
          <line x1="6" y1="6" x2="14" y2="6" stroke={bc} strokeWidth="2.5" />
          <line x1="6" y1="6" x2="6" y2="14" stroke={bc} strokeWidth="2.5" />
          <line x1="38" y1="6" x2="30" y2="6" stroke={bc} strokeWidth="2.5" />
          <line x1="38" y1="6" x2="38" y2="14" stroke={bc} strokeWidth="2.5" />
          <line x1="6" y1="38" x2="14" y2="38" stroke={bc} strokeWidth="2.5" />
          <line x1="6" y1="38" x2="6" y2="30" stroke={bc} strokeWidth="2.5" />
          <line x1="38" y1="38" x2="30" y2="38" stroke={bc} strokeWidth="2.5" />
          <line x1="38" y1="38" x2="38" y2="30" stroke={bc} strokeWidth="2.5" />
        </svg>
      )
    }
    if (id === 'property-line' || id === 'setback-line' || id === 'build-to-line') {
      const lc = el.defaultStyle.strokeColor ?? '#DB2777'
      const ld = el.defaultStyle.lineType === 'dashed' ? '5 3' : undefined
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#1E293B" />
          <line x1="4" y1="22" x2="40" y2="22" stroke={lc} strokeWidth="2" strokeLinecap="round" strokeDasharray={ld} />
          <line x1="4" y1="18" x2="4" y2="26" stroke={lc} strokeWidth="1.5" />
          <line x1="40" y1="18" x2="40" y2="26" stroke={lc} strokeWidth="1.5" />
        </svg>
      )
    }
    if (id === 'flood-zone' || id === 'easement' || id === 'height-limit' || id === 'view-corridor') {
      const oc = el.defaultStyle.fillColor ?? '#3B82F6'
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#1E293B" />
          <rect x="4" y="4" width="36" height="36" rx="3" fill={hex(oc, 0.35)} />
          <rect x="4" y="4" width="36" height="36" rx="3" fill="none" stroke={oc} strokeWidth="1" strokeDasharray="4 3" />
        </svg>
      )
    }
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#1E293B" />
        <text x="22" y="27" textAnchor="middle" fontSize="18" fontWeight="700" fill={strokeC} fontFamily="serif" opacity="0.85">Aa</text>
        <line x1="8" y1="33" x2="36" y2="33" stroke={strokeC} strokeWidth="0.75" opacity="0.3" />
      </svg>
    )
  }

  // ── Buildings ──────────────────────────────────────────────────────────
  if (cat === 'buildings') {
    const floors = (el.defaultProps as Record<string, unknown>)?.floors as number ?? 2
    const isHighrise = floors >= 15
    const isMidrise = floors >= 5 && floors < 15
    const shadow = hex('#000000', 0.35)
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill="#E2E8F0" />
        {/* Drop shadow */}
        <rect x="12" y="12" width="26" height="26" rx="1" fill={shadow} />
        {/* Footprint */}
        <rect x="8" y="8" width="26" height="26" rx="1" fill={fillC} />
        {/* Roof shading */}
        <rect x="8" y="8" width="26" height="6" rx="1" fill="rgba(255,255,255,0.2)" />
        {/* Floor grid for mid/high-rise */}
        {(isMidrise || isHighrise) && [14, 20, 26].map(x => (
          <line key={x} x1={x} y1="8" x2={x} y2="34" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
        ))}
        {/* Corner marks */}
        <line x1="8" y1="8" x2="11" y2="8" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <line x1="8" y1="8" x2="8" y2="11" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <line x1="34" y1="8" x2="31" y2="8" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <line x1="34" y1="8" x2="34" y2="11" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
      </svg>
    )
  }

  // ── Land Use / Zoning ──────────────────────────────────────────────────
  if (cat === 'landuse') {
    const fc = el.defaultStyle.fillColor ?? '#FDE68A'
    const isLine = el.drawMode === 'line'
    const isPlace = el.drawMode === 'place'
    if (isLine) {
      const lc = el.defaultStyle.strokeColor ?? '#F97316'
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#1E293B" />
          <line x1="4" y1="22" x2="40" y2="22" stroke={lc} strokeWidth={Math.max(sw * 1.5, 2.5)} strokeLinecap="round" />
        </svg>
      )
    }
    if (isPlace) {
      const pc = el.defaultStyle.fillColor ?? '#F97316'
      return (
        <svg width="44" height="44" viewBox="0 0 44 44">
          <rect width="44" height="44" rx="4" fill="#1E293B" />
          <circle cx="22" cy="22" r="9" fill={hex(pc, 0.3)} stroke={pc} strokeWidth="1.5" />
          <circle cx="22" cy="22" r="4" fill={pc} opacity="0.85" />
        </svg>
      )
    }
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={fc} fillOpacity="0.5" />
        <rect x="4" y="4" width="36" height="36" rx="3" fill="none" stroke={hex(fc, 0.9)} strokeWidth="1.5" strokeDasharray="4 3" />
        <text x="22" y="27" textAnchor="middle" fontSize="11" fontWeight="700" fill={hex('#000000', 0.5)} fontFamily="sans-serif">
          {el.id.replace('lu-', '').replace('z-', '').replace('fbc-', '').replace('lot-', '').toUpperCase().slice(0, 4)}
        </text>
      </svg>
    )
  }

  // ── Generic fallbacks by drawMode ──────────────────────────────────────
  if (el.drawMode === 'line') {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={hex(strokeC, 0.1)} />
        <line x1="6" y1="30" x2="38" y2="14" stroke={strokeC} strokeWidth={Math.max(sw * 1.5, 2)} strokeLinecap="round" />
      </svg>
    )
  }
  if (el.drawMode === 'circle' || el.drawMode === 'place') {
    return (
      <svg width="44" height="44" viewBox="0 0 44 44">
        <rect width="44" height="44" rx="4" fill={hex(fillC, 0.1)} />
        <circle cx="22" cy="20" r="10" fill={fillC} opacity="0.85" />
        <circle cx="22" cy="20" r="10" fill="none" stroke={hex(fillC, 0.6)} strokeWidth="1" />
        <ellipse cx="22" cy="35" rx="7" ry="2.5" fill={fillC} opacity="0.15" />
      </svg>
    )
  }
  // Generic polygon / rect
  return (
    <svg width="44" height="44" viewBox="0 0 44 44">
      <rect width="44" height="44" rx="4" fill={hex(fillC, 0.15)} />
      <rect x="6" y="6" width="32" height="32" rx="3" fill={fillC} stroke={strokeC} strokeWidth={Math.max(sw, 1)} opacity="0.85" />
    </svg>
  )
}

// ── Component ──────────────────────────────────────────────────────────────

export function ElementLibraryZone() {
  const { setActiveElementType, activeElementType, setActiveTool, setActiveStyle } = useUIStore()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectElement(el: ElementTypeDefinition) {
    setActiveElementType(el.id)
    // Apply the element's default style so drawn features look correct
    if (el.defaultStyle) setActiveStyle(el.defaultStyle)
    // Switch to the appropriate draw tool for this element type
    const dm = el.drawMode
    if (dm === 'line') setActiveTool('line')
    else if (dm === 'polygon') setActiveTool('pen')
    else if (dm === 'circle') setActiveTool('ellipse')
    else if (dm === 'rect') setActiveTool('rect')
    else if (dm === 'place') setActiveTool('select') // click-to-place via canvas
    else setActiveTool('pen')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
      {ELEMENT_CATEGORIES.map(cat => {
        const isOpen = !collapsed.has(cat.id)
        return (
          <div key={cat.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
            <button
              onClick={() => toggle(cat.id)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text)',
                borderBottom: isOpen ? '1px solid var(--color-border)' : 'none',
              }}
            >
              <span style={{ flex: 1, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)' }}>{cat.label}</span>
              <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms', flexShrink: 0, opacity: 0.4 }}>
                <polyline points="1,3 5,7 9,3" fill="none" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>

            {isOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 5, padding: '8px 8px 10px' }}>
                {cat.elements.map(el => {
                  const active = activeElementType === el.id
                  return (
                    <button
                      key={el.id}
                      onClick={() => selectElement(el)}
                      title={el.label}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        padding: '6px 4px', borderRadius: 7, cursor: 'pointer',
                        border: `1.5px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
                        background: active ? 'var(--color-accent-subtle)' : 'transparent',
                        transition: 'all 100ms',
                      }}
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--color-bg-elevated)'; e.currentTarget.style.borderColor = 'var(--color-border)' } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent' } }}
                    >
                      <TilePreview el={el} />
                      <span style={{ fontSize: 9, color: active ? 'var(--color-accent)' : 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.2, maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', fontWeight: active ? 600 : 400 }}>
                        {el.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
