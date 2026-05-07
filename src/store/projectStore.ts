import { create } from 'zustand'
import type { SaveState } from '../api/supabase'

interface Project {
  id: string
  name: string
  ownerId: string
  thumbnailUrl?: string
  updatedAt: string
}

interface ProjectState {
  currentProject: Project | null
  projectId: string | null
  saveState: SaveState
  isGuest: boolean
  projectName: string

  setCurrentProject: (p: Project | null) => void
  setProjectId: (id: string | null) => void
  setSaveState: (s: SaveState) => void
  setIsGuest: (v: boolean) => void
  setProjectName: (name: string) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProject: null,
  projectId: null,
  saveState: 'saved',
  isGuest: true,
  projectName: 'Downtown Mobility Study',

  setCurrentProject: (p) => set({ currentProject: p }),
  setProjectId: (id) => set({ projectId: id }),
  setSaveState: (s) => set({ saveState: s }),
  setIsGuest: (v) => set({ isGuest: v }),
  setProjectName: (name) => set({ projectName: name }),
}))
