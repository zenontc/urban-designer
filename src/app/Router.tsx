import React, { useState, useEffect } from 'react'
import { LandingPage } from '../pages/LandingPage'
import { Dashboard } from '../pages/Dashboard'
import { WorkspacePage } from '../pages/WorkspacePage'
import { supabase } from '../api/supabase'
import { useProjectStore } from '../store/projectStore'

type Page = 'landing' | 'dashboard' | 'workspace'

export function Router() {
  const [page, setPage] = useState<Page>('landing')
  const [authChecked, setAuthChecked] = useState(false)
  const { setIsGuest } = useProjectStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setIsGuest(false)
        setPage('dashboard')
      }
      setAuthChecked(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setIsGuest(true)
        setPage('landing')
      } else if (event === 'SIGNED_IN' && session) {
        setIsGuest(false)
        setPage('dashboard')
      }
    })

    return () => subscription.unsubscribe()
  }, [setIsGuest])

  function navigate(target: string) {
    if (target === 'dashboard' || target === 'landing' || target === 'workspace') {
      setPage(target as Page)
    }
  }

  if (!authChecked) {
    return (
      <div style={{
        width: '100vw', height: '100vh', background: '#0A0F1E',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: 48, height: 48, background: '#A3B57A', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 800, fontSize: 18, fontFamily: "'Inter Tight', sans-serif",
        }}>UD</div>
      </div>
    )
  }

  switch (page) {
    case 'landing':    return <LandingPage onNavigate={navigate} />
    case 'dashboard':  return <Dashboard onNavigate={navigate} />
    case 'workspace':  return <WorkspacePage onNavigate={navigate} />
    default:           return <LandingPage onNavigate={navigate} />
  }
}
