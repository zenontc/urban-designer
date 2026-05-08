import React from 'react'

interface IconProps {
  name: string
  size?: number
  color?: string
  strokeWidth?: number
}

const ICONS: Record<string, React.ReactNode> = {
  select: <><path d="M5 3l14 9-7 1-4 7L5 3z" strokeLinecap="round" strokeLinejoin="round"/></>,
  directSelect: <><circle cx="5" cy="5" r="1.5"/><circle cx="19" cy="5" r="1.5"/><circle cx="5" cy="19" r="1.5"/><circle cx="19" cy="19" r="1.5"/><path d="M5 5h14v14H5z" fill="none" strokeLinecap="round"/></>,
  pen: <><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round"/></>,
  line: <><path d="M5 19L19 5M5 5h4M15 19h4" strokeLinecap="round"/></>,
  rect: <><rect x="3" y="3" width="18" height="18" rx="2" fill="none"/></>,
  ellipse: <><ellipse cx="12" cy="12" rx="10" ry="7" fill="none"/></>,
  polygon: <><path d="M12 3l9 6-3 10H6L3 9l9-6z" fill="none" strokeLinejoin="round"/></>,
  addNode: <><circle cx="12" cy="12" r="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round"/></>,
  deleteNode: <><circle cx="12" cy="12" r="2"/><path d="M4 4l16 16M20 4L4 20" strokeLinecap="round"/></>,
  scissors: <><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12" strokeLinecap="round"/></>,
  text: <><path d="M4 6h16M12 6v12M8 18h8" strokeLinecap="round"/></>,
  dimension: <><path d="M3 17h18M3 7h18M3 7l2 2M3 7l2-2M21 7l-2 2M21 7l-2-2M3 17l2 2M3 17l2-2M21 17l-2 2M21 17l-2-2" strokeLinecap="round"/></>,
  measure: <><path d="M2 12h20M5 8l-3 4 3 4M19 8l3 4-3 4" strokeLinecap="round" strokeLinejoin="round"/></>,
  hand: <><path d="M18 11V6a2 2 0 00-2-2v0a2 2 0 00-2 2v0M14 10V4a2 2 0 00-2-2v0a2 2 0 00-2 2v0v3M10 9.5V5a2 2 0 00-2-2v0a2 2 0 00-2 2v0v8l-1.5-1.8a1.5 1.5 0 00-2.1-.2v0a1.5 1.5 0 00-.2 2.1l4.2 5.4A5 5 0 0012 21h2a5 5 0 005-5v-5a2 2 0 00-2-2v0a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round"/></>,
  zoom: <><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6M11 8v6" strokeLinecap="round"/></>,
  layers: <><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
  eyeOff: <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" strokeLinecap="round"/></>,
  lock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4" strokeLinecap="round"/></>,
  unlock: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 019.9-1" strokeLinecap="round"/></>,
  trash: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round"/></>,
  chevronDown: <><polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round"/></>,
  chevronRight: <><polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round"/></>,
  chevronUp: <><polyline points="18 15 12 9 6 15" strokeLinecap="round" strokeLinejoin="round"/></>,
  chevronLeft: <><polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round"/></>,
  search: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
  minus: <><line x1="5" y1="12" x2="19" y2="12"/></>,
  x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
  check: <><polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/></>,
  share: <><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></>,
  save: <><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
  undo: <><path d="M3 10h11a5 5 0 010 10h-3" strokeLinecap="round" strokeLinejoin="round" fill="none"/><polyline points="7 6 3 10 7 14" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
  redo: <><path d="M21 10H10a5 5 0 000 10h3" strokeLinecap="round" strokeLinejoin="round" fill="none"/><polyline points="17 6 21 10 17 14" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
  sun: <><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></>,
  moon: <><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></>,
  map: <><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></>,
  maximize: <><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></>,
  cube3d: <><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>,
  compass: <><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></>,
  info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>,
  file: <><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></>,
  download: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
  upload: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  copy: <><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></>,
  grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
  sliders: <><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>,
  barChart: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
  arrowRight: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
  zoomIn: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></>,
  zoomOut: <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></>,
  rotate: <><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" strokeLinecap="round"/></>,
  building: <><rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01"/></>,
  tree: <><path d="M12 22V13M12 13l-3-4H6l4-6h4l4 6h-3l-3 4z" strokeLinejoin="round"/></>,
  road: <><path d="M3 17h18M3 7h18M9 7l-3 10M15 7l3 10" strokeLinecap="round"/></>,
  bike: <><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 100-2 1 1 0 000 2zm-3 11.5L9 10l-1.5-3h4L15 14l1-3.5h3" strokeLinecap="round" strokeLinejoin="round"/></>,
  water: <><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="none"/><path d="M12 8v8M8 12l4 4 4-4" strokeLinecap="round" strokeLinejoin="round"/></>,
  person: <><circle cx="12" cy="7" r="4"/><path d="M20 21a8 8 0 00-16 0" strokeLinecap="round"/></>,
  opacity: <><circle cx="12" cy="12" r="10" strokeDasharray="3 2"/><path d="M12 2v20M2 12h20" strokeOpacity="0.4"/></>,
  strokeWidth: <><line x1="3" y1="6" x2="21" y2="6" strokeWidth="1"/><line x1="3" y1="12" x2="21" y2="12" strokeWidth="2.5"/><line x1="3" y1="18" x2="21" y2="18" strokeWidth="4.5"/></>,
  play: <><polygon points="5 3 19 12 5 21 5 3"/></>,
  pause: <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>,
  externalLink: <><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></>,
  alertTriangle: <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
  import: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
  extrude: <><path d="M12 2l8 4v8l-8 4-8-4V6l8-4z" fill="none" strokeLinejoin="round"/><path d="M12 10l8-4M12 10v12M12 10l-8-4" strokeLinecap="round"/></>,
  elements: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  penPath: <><path d="M3 21l5-5M3 21l1-5 14-9-1 5L3 21z" strokeLinejoin="round"/><circle cx="18" cy="6" r="3"/><path d="M15.5 8.5L7 17" strokeDasharray="2 2"/></>,
}

export function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke={color} strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {ICONS[name] ?? <circle cx="12" cy="12" r="10" />}
    </svg>
  )
}
