import { create } from 'zustand'
import type mapboxgl from 'mapbox-gl'

interface MapState {
  mapInstance: mapboxgl.Map | null
  rotation: number
  zoom: number
  center: [number, number]
  pitch: number

  setMapInstance: (map: mapboxgl.Map | null) => void
  setRotation: (r: number) => void
  setZoom: (z: number) => void
  setCenter: (c: [number, number]) => void
  setPitch: (p: number) => void
}

export const useMapStore = create<MapState>((set) => ({
  mapInstance: null,
  rotation: 0,
  zoom: 16,
  center: [-122.4194, 37.7749],
  pitch: 0,

  setMapInstance: (map) => set({ mapInstance: map }),
  setRotation: (r) => set({ rotation: Math.min(359, Math.max(0, r)) }),
  setZoom: (z) => set({ zoom: z }),
  setCenter: (c) => set({ center: c }),
  setPitch: (p) => set({ pitch: p }),
}))
