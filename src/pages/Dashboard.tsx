import React, { useState, useEffect } from 'react'
import { supabase } from '../api/supabase'
import { useProjectStore } from '../store/projectStore'
import { useCanvasStore } from '../store/canvasStore'
import type { UMPFeature } from '../store/canvasStore'

interface DashboardProps {
  onNavigate: (page: string) => void
}

interface Project {
  id: string
  name: string
  updated_at: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const BG_COLORS = ['#A3B57A', '#0EA5E9', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444']

export function Dashboard({ onNavigate }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const { setProjectId, setProjectName, setIsGuest } = useProjectStore()
  const { setFeatures } = useCanvasStore()

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoading(true)
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, updated_at')
      .order('updated_at', { ascending: false })
    if (!error && data) setProjects(data)
    setLoading(false)
  }

  async function openProject(project: Project) {
    setProjectId(project.id)
    setProjectName(project.name)
    setIsGuest(false)

    // Load project geojson into canvas
    const { data } = await supabase
      .from('projects')
      .select('geojson')
      .eq('id', project.id)
      .single()

    if (data?.geojson) {
      setFeatures((data.geojson.features ?? []) as UMPFeature[])
    } else {
      setFeatures([])
    }

    onNavigate('workspace')
  }

  async function createProject() {
    const name = newName.trim() || 'New Project'
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreating(false); return }

    const { data, error } = await supabase
      .from('projects')
      .insert({ name, user_id: user.id, geojson: { type: 'FeatureCollection', features: [] } })
      .select('id, name, updated_at')
      .single()

    setCreating(false)
    setShowNewModal(false)
    setNewName('')

    if (data && !error) {
      setProjectId(data.id)
      setProjectName(data.name)
      setFeatures([])
      onNavigate('workspace')
    }
  }

  async function deleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this project? This cannot be undone.')) return
    await supabase.from('projects').delete().eq('id', id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        height: 56, background: '#fff', borderBottom: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        <div style={{
          width: 32, height: 32, background: '#A3B57A', borderRadius: 7,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 13, fontFamily: "'Inter Tight', sans-serif",
          flexShrink: 0,
        }}>UD</div>
        <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A' }}>Urban Designer</span>
        <div style={{ flex: 1 }} />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search projects…"
          style={{
            height: 32, width: 200, padding: '0 12px', fontSize: 13,
            borderRadius: 6, border: '1px solid #D1D5DB',
            background: '#F9FAFB', color: '#111827', outline: 'none',
          }} />
        <button
          onClick={() => setShowNewModal(true)}
          style={{
            height: 34, padding: '0 16px', fontSize: 13, fontWeight: 600,
            borderRadius: 6, border: 'none', background: '#1D4ED8',
            color: '#fff', cursor: 'pointer',
          }}>
          New Project
        </button>
        <button onClick={handleSignOut} style={{
          height: 34, padding: '0 12px', fontSize: 13, fontWeight: 500,
          borderRadius: 6, border: '1px solid #D1D5DB',
          background: '#fff', color: '#6B7280', cursor: 'pointer',
        }}>
          Sign Out
        </button>
      </header>

      {/* Main */}
      <main style={{ flex: 1, padding: '36px 48px', overflowY: 'auto' }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: '0 0 24px' }}>My Projects</h2>

        {loading ? (
          <div style={{ color: '#94A3B8', fontSize: 14 }}>Loading projects…</div>
        ) : filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, height: 300, color: '#94A3B8' }}>
            <div style={{ fontSize: 48 }}>🗺</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#64748B' }}>
              {search ? 'No projects match your search' : 'No projects yet'}
            </div>
            {!search && (
              <button onClick={() => setShowNewModal(true)} style={{
                height: 38, padding: '0 20px', fontSize: 13, fontWeight: 600,
                borderRadius: 7, border: 'none', background: '#1D4ED8',
                color: '#fff', cursor: 'pointer', marginTop: 4,
              }}>
                Create your first project
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {filtered.map((p, i) => (
              <ProjectCard
                key={p.id} project={p}
                color={BG_COLORS[i % BG_COLORS.length]}
                onClick={() => openProject(p)}
                onDelete={(e) => deleteProject(p.id, e)}
              />
            ))}
          </div>
        )}
      </main>

      {/* New project modal */}
      {showNewModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100,
        }} onClick={() => setShowNewModal(false)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 28, width: 380,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 16px' }}>New Project</h3>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createProject()}
              placeholder="Project name"
              autoFocus
              style={{
                width: '100%', height: 38, padding: '0 12px', fontSize: 14,
                borderRadius: 7, border: '1px solid #D1D5DB',
                background: '#F9FAFB', color: '#111827', outline: 'none',
                boxSizing: 'border-box', marginBottom: 16,
              }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowNewModal(false)} style={{
                flex: 1, height: 38, borderRadius: 7, border: '1px solid #D1D5DB',
                background: '#fff', color: '#374151', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={createProject} disabled={creating} style={{
                flex: 1, height: 38, borderRadius: 7, border: 'none',
                background: creating ? '#93C5FD' : '#1D4ED8', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: creating ? 'not-allowed' : 'pointer',
              }}>
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project, color, onClick, onDelete }: {
  project: Project; color: string
  onClick: () => void; onDelete: (e: React.MouseEvent) => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 220, borderRadius: 10, overflow: 'hidden',
        border: `1px solid ${hovered ? '#CBD5E1' : '#E2E8F0'}`,
        background: '#fff', cursor: 'pointer',
        boxShadow: hovered ? '0 4px 20px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'box-shadow 150ms, border-color 150ms',
        position: 'relative',
      }}>
      {/* Thumbnail */}
      <div style={{
        height: 130, background: color, position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="80" height="60" viewBox="0 0 80 60" opacity="0.3">
          <rect x="5" y="10" width="30" height="18" rx="1" fill="#fff" />
          <rect x="40" y="6" width="35" height="25" rx="1" fill="#fff" />
          <line x1="0" y1="35" x2="80" y2="35" stroke="#fff" strokeWidth="4" />
          <rect x="10" y="42" width="18" height="12" rx="1" fill="#fff" />
          <rect x="32" y="44" width="22" height="10" rx="1" fill="#fff" />
          <rect x="58" y="40" width="16" height="14" rx="1" fill="#fff" />
        </svg>
        {hovered && (
          <button
            onClick={onDelete}
            title="Delete project"
            style={{
              position: 'absolute', top: 8, right: 8,
              width: 26, height: 26, borderRadius: 6,
              border: 'none', background: 'rgba(0,0,0,0.4)',
              color: '#fff', fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>×</button>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '10px 14px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {project.name}
        </div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>
          Edited {timeAgo(project.updated_at)}
        </div>
      </div>
    </div>
  )
}
