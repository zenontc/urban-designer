import type { UMPFeature } from '../store/canvasStore'

// ─── GeoJSON ────────────────────────────────────────────────────────────────

export function exportGeoJSON(features: UMPFeature[], filename = 'urban-design.geojson') {
  const fc: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features }
  const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/geo+json' })
  download(blob, filename)
}

// ─── PNG (via mapbox preserveDrawingBuffer) ──────────────────────────────────

export async function exportPNG(mapContainer: HTMLElement, filename = 'urban-design.png') {
  const { default: html2canvas } = await import('html2canvas')
  const canvas = await html2canvas(mapContainer, { useCORS: true, allowTaint: true, scale: 2 })
  canvas.toBlob(blob => { if (blob) download(blob, filename) }, 'image/png')
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export async function exportPDF(mapContainer: HTMLElement, projectName: string) {
  const { default: html2canvas } = await import('html2canvas')
  const { jsPDF } = await import('jspdf')

  const canvas = await html2canvas(mapContainer, { useCORS: true, allowTaint: true, scale: 1.5 })
  const imgData = canvas.toDataURL('image/png')

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] })
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
  pdf.save(`${projectName}.pdf`)
}

// ─── KMZ (GeoJSON → KML → zip) ───────────────────────────────────────────────

export async function exportKMZ(features: UMPFeature[], projectName: string) {
  const { default: JSZip } = await import('jszip')

  const kml = buildKML(features, projectName)
  const zip = new JSZip()
  zip.file('doc.kml', kml)
  const blob = await zip.generateAsync({ type: 'blob' })
  download(blob, `${projectName}.kmz`)
}

function buildKML(features: UMPFeature[], name: string): string {
  const placemarks = features.map(f => {
    const coords = geometryToKMLCoords(f.geometry)
    if (!coords) return ''
    const color = hexToKMLColor(f.properties.style.strokeColor)
    return `  <Placemark>
    <name>${escapeXML(f.properties.label)}</name>
    <Style>
      <LineStyle><color>${color}</color><width>${f.properties.style.strokeWidth}</width></LineStyle>
      <PolyStyle><color>${hexToKMLColor(f.properties.style.fillColor, 0.5)}</color></PolyStyle>
    </Style>
    ${coords}
  </Placemark>`
  }).filter(Boolean).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${escapeXML(name)}</name>
${placemarks}
</Document>
</kml>`
}

function geometryToKMLCoords(geometry: GeoJSON.Geometry): string | null {
  if (geometry.type === 'Point') {
    const [lng, lat] = geometry.coordinates
    return `<Point><coordinates>${lng},${lat},0</coordinates></Point>`
  }
  if (geometry.type === 'LineString') {
    const coords = geometry.coordinates.map(c => `${c[0]},${c[1]},0`).join(' ')
    return `<LineString><coordinates>${coords}</coordinates></LineString>`
  }
  if (geometry.type === 'Polygon') {
    const outer = geometry.coordinates[0].map(c => `${c[0]},${c[1]},0`).join(' ')
    return `<Polygon><outerBoundaryIs><LinearRing><coordinates>${outer}</coordinates></LinearRing></outerBoundaryIs></Polygon>`
  }
  return null
}

function hexToKMLColor(hex: string, alpha = 1): string {
  const clean = hex.replace('#', '')
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  const r = clean.slice(0, 2); const g = clean.slice(2, 4); const b = clean.slice(4, 6)
  return `${a}${b}${g}${r}` // KML is AABBGGRR
}

function escapeXML(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── SHP (shapefile) ─────────────────────────────────────────────────────────

export async function exportSHP(features: UMPFeature[], projectName: string) {
  // shpjs supports reading but not writing — use a simple CSV of centroids as fallback
  const rows = ['id,label,type,lat,lng']
  features.forEach(f => {
    const centroid = getCentroid(f.geometry)
    if (centroid) {
      rows.push(`${f.properties.id},${f.properties.label},${f.properties.elementType},${centroid[1]},${centroid[0]}`)
    }
  })
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
  download(blob, `${projectName}-centroids.csv`)
}

function getCentroid(geometry: GeoJSON.Geometry): [number, number] | null {
  if (geometry.type === 'Point') return geometry.coordinates as [number, number]
  if (geometry.type === 'LineString') {
    const mid = Math.floor(geometry.coordinates.length / 2)
    return geometry.coordinates[mid] as [number, number]
  }
  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates[0]
    const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length
    const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
    return [lng, lat]
  }
  return null
}

// ─── helper ──────────────────────────────────────────────────────────────────

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
