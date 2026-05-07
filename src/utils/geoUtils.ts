const DEG_TO_FT = 364000 // approx feet per degree latitude

function toRadians(deg: number) { return deg * Math.PI / 180 }

/** Great-circle distance in feet between two [lng, lat] points */
export function distanceFt(a: [number, number], b: [number, number]): number {
  const R = 20902231 // Earth radius in feet
  const dLat = toRadians(b[1] - a[1])
  const dLng = toRadians(b[0] - a[0])
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * sinLng * sinLng
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Line string total length in feet */
export function lineStringLengthFt(coords: number[][]): number {
  let total = 0
  for (let i = 1; i < coords.length; i++) {
    total += distanceFt(coords[i - 1] as [number, number], coords[i] as [number, number])
  }
  return total
}

/** Polygon area in square feet using shoelace + Mercator approximation */
export function polygonAreaSqFt(coords: number[][]): number {
  if (coords.length < 3) return 0
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
  const scaleX = DEG_TO_FT * Math.cos(toRadians(lat))
  const scaleY = DEG_TO_FT

  let area = 0
  const n = coords.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += coords[i][0] * scaleX * coords[j][1] * scaleY
    area -= coords[j][0] * scaleX * coords[i][1] * scaleY
  }
  return Math.abs(area / 2)
}

export function sqFtToAcres(sqFt: number): number { return sqFt / 43560 }
export function sqFtToHa(sqFt: number): number { return sqFt * 0.0000929 }
export function ftToM(ft: number): number { return ft * 0.3048 }

/** Format a number with commas */
export function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
