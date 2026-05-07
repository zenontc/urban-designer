import { useEffect, useRef, useCallback } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useCanvasStore } from '../store/canvasStore'
import { supabase } from '../api/supabase'

const DEBOUNCE_MS = 30_000

export function useAutoSave() {
  const { projectId, isGuest, setSaveState } = useProjectStore()
  const { features } = useCanvasStore()
  const timer = useRef<number>(0)
  const lastSaved = useRef<string>('')

  const save = useCallback(async () => {
    if (isGuest || !projectId) {
      // Guest: persist to localStorage
      const snapshot = JSON.stringify(features)
      localStorage.setItem(`ump_draft_${projectId ?? 'guest'}`, snapshot)
      setSaveState('saved')
      return
    }

    const snapshot = JSON.stringify(features)
    if (snapshot === lastSaved.current) { setSaveState('saved'); return }

    setSaveState('saving')
    try {
      const { error } = await supabase
        .from('projects')
        .update({ geojson: features, updated_at: new Date().toISOString() })
        .eq('id', projectId)

      if (error) throw error
      lastSaved.current = snapshot
      setSaveState('saved')
    } catch {
      setSaveState('unsaved')
    }
  }, [features, isGuest, projectId, setSaveState])

  // Debounced auto-save whenever features change
  useEffect(() => {
    if (features.length === 0) return
    setSaveState('unsaved')
    clearTimeout(timer.current)
    timer.current = window.setTimeout(save, DEBOUNCE_MS)
    return () => clearTimeout(timer.current)
  }, [features, save, setSaveState])

  // Cmd+S / Ctrl+S force save
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        clearTimeout(timer.current)
        save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [save])

  return { save }
}
