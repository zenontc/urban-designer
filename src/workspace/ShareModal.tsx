import React, { useState } from 'react'
import { Icon } from './components/Icon'
import { useUIStore } from '../store/uiStore'
import { useProjectStore } from '../store/projectStore'

type Permission = 'view' | 'comment' | 'edit'

const PERM_LABELS: Record<Permission, string> = {
  view: 'Can view',
  comment: 'Can comment',
  edit: 'Can edit',
}

interface Collaborator {
  email: string
  permission: Permission
}

export function ShareModal() {
  const { toggleShareModal } = useUIStore()
  const { projectName } = useProjectStore()
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<Permission>('view')
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [linkPermission, setLinkPermission] = useState<Permission>('view')
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'invite' | 'link'>('invite')

  const shareLink = `https://urbandesigner.app/view/${Math.random().toString(36).slice(2, 10)}`

  function addCollaborator() {
    if (!email.trim() || !email.includes('@')) return
    setCollaborators(prev => [...prev, { email: email.trim(), permission }])
    setEmail('')
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) toggleShareModal() }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} />

      <div style={{ position: 'relative', width: 460, background: 'var(--color-bg-panel)', borderRadius: 12, border: '1px solid var(--color-border)', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>Share "{projectName}"</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>Invite people or share a link</div>
          </div>
          <button onClick={toggleShareModal} style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)' }}>
          {(['invite', 'link'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, height: 36, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: tab === t ? 600 : 400, color: tab === t ? 'var(--color-accent)' : 'var(--color-text-sec)', borderBottom: `2px solid ${tab === t ? 'var(--color-accent)' : 'transparent'}` }}>
              {t === 'invite' ? 'Invite people' : 'Share link'}
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 20px' }}>
          {tab === 'invite' ? (
            <>
              {/* Email input */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCollaborator()}
                  placeholder="Email address"
                  style={{ flex: 1, height: 36, padding: '0 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text)', outline: 'none' }} />
                <select value={permission} onChange={e => setPermission(e.target.value as Permission)}
                  style={{ height: 36, padding: '0 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text)', cursor: 'pointer' }}>
                  {(Object.keys(PERM_LABELS) as Permission[]).map(p => <option key={p} value={p}>{PERM_LABELS[p]}</option>)}
                </select>
                <button onClick={addCollaborator} style={{ height: 36, padding: '0 14px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer' }}>
                  Invite
                </button>
              </div>

              {/* Collaborator list */}
              {collaborators.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: 160, overflowY: 'auto' }}>
                  {collaborators.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: 'var(--color-bg-elevated)' }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                        {c.email[0].toUpperCase()}
                      </div>
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--color-text)' }}>{c.email}</span>
                      <select value={c.permission} onChange={e => setCollaborators(prev => prev.map((x, j) => j === i ? { ...x, permission: e.target.value as Permission } : x))}
                        style={{ fontSize: 11, border: 'none', background: 'transparent', color: 'var(--color-text-sec)', cursor: 'pointer' }}>
                        {(Object.keys(PERM_LABELS) as Permission[]).map(p => <option key={p} value={p}>{PERM_LABELS[p]}</option>)}
                      </select>
                      <button onClick={() => setCollaborators(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 0 }}>
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {collaborators.length === 0 && (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>
                  No collaborators yet. Enter an email above to invite.
                </div>
              )}
            </>
          ) : (
            <>
              {/* Link permissions */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>Anyone with the link</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(Object.keys(PERM_LABELS) as Permission[]).map(p => (
                    <button key={p} onClick={() => setLinkPermission(p)} style={{ flex: 1, height: 30, fontSize: 11, fontWeight: linkPermission === p ? 600 : 400, borderRadius: 5, border: `1px solid ${linkPermission === p ? 'var(--color-accent)' : 'var(--color-border)'}`, background: linkPermission === p ? 'var(--color-accent-subtle)' : 'transparent', color: linkPermission === p ? 'var(--color-accent)' : 'var(--color-text-sec)', cursor: 'pointer' }}>
                      {PERM_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Link copy */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, height: 36, padding: '0 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareLink}</span>
                </div>
                <button onClick={copyLink} style={{ height: 36, padding: '0 14px', fontSize: 12, fontWeight: 600, borderRadius: 6, border: '1px solid var(--color-border)', background: copied ? '#22C55E' : 'transparent', color: copied ? '#fff' : 'var(--color-text-sec)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 200ms' }}>
                  <Icon name={copied ? 'check' : 'copy'} size={13} />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 6, background: 'var(--color-bg-elevated)', fontSize: 11, color: 'var(--color-text-muted)' }}>
                View-only links don't require sign-in. Edit links require a free Urban Designer account.
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 20px 16px', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={toggleShareModal} style={{ height: 34, padding: '0 16px', fontSize: 13, fontWeight: 600, borderRadius: 6, border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: 'pointer' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
