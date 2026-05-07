import React, { useState } from 'react'
import { LandingPage } from '../pages/LandingPage'
import { Dashboard } from '../pages/Dashboard'
import { WorkspacePage } from '../pages/WorkspacePage'

type Page = 'landing' | 'dashboard' | 'workspace'

export function Router() {
  const [page, setPage] = useState<Page>('workspace')

  function navigate(target: string) {
    if (target === 'dashboard' || target === 'landing' || target === 'workspace') {
      setPage(target as Page)
    }
  }

  switch (page) {
    case 'landing':    return <LandingPage onNavigate={navigate} />
    case 'dashboard':  return <Dashboard onNavigate={navigate} />
    case 'workspace':  return <WorkspacePage onNavigate={navigate} />
    default:           return <WorkspacePage onNavigate={navigate} />
  }
}
