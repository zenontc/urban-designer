import mapboxgl from 'mapbox-gl'

export function lngLatToScreen(map: mapboxgl.Map, lngLat: [number, number]): [number, number] {
  const p = map.project(lngLat as mapboxgl.LngLatLike)
  return [p.x, p.y]
}

export function screenToLngLat(map: mapboxgl.Map, x: number, y: number): [number, number] {
  const ll = map.unproject([x, y])
  return [ll.lng, ll.lat]
}

export function metersPerPixel(zoom: number, lat: number): number {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * Math.pow(2, zoom))
}

export function feetToPixels(map: mapboxgl.Map, feet: number, lat: number): number {
  const mpp = metersPerPixel(map.getZoom(), lat)
  return (feet * 0.3048) / mpp
}

export function haversineFt(a: [number, number], b: [number, number]): number {
  const R = 20902231
  const dLat = ((b[1] - a[1]) * Math.PI) / 180
  const dLon = ((b[0] - a[0]) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[1] * Math.PI) / 180) * Math.cos((b[1] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(s))
}

export function fmtDist(ft: number): string {
  return ft < 5280 ? `${Math.round(ft)} ft` : `${(ft / 5280).toFixed(2)} mi`
}

export function distToSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1
  const len2 = C * C + D * D
  const t = len2 !== 0 ? Math.max(0, Math.min(1, (A * C + B * D) / len2)) : 0
  return Math.hypot(px - (x1 + t * C), py - (y1 + t * D))
}

export function pointInPolygon(pt: [number, number], ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

export function screenBbox(pts: [number, number][]): { x: number; y: number; w: number; h: number } {
  if (!pts.length) return { x: 0, y: 0, w: 0, h: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) {
    minX = Math.min(minX, x); minY = Math.min(minY, y)
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}
