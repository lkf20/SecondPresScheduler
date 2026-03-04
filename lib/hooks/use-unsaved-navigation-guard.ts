'use client'

import { useCallback, useEffect, useState } from 'react'

interface UseUnsavedNavigationGuardOptions {
  hasUnsavedChanges: boolean
  onNavigate: (path: string) => void
}

export function useUnsavedNavigationGuard({
  hasUnsavedChanges,
  onNavigate,
}: UseUnsavedNavigationGuardOptions) {
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  const navigateWithUnsavedGuard = useCallback(
    (path: string) => {
      if (hasUnsavedChanges) {
        setPendingPath(path)
        setShowUnsavedDialog(true)
        return
      }
      onNavigate(path)
    },
    [hasUnsavedChanges, onNavigate]
  )

  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return

      const nextUrl = new URL(anchor.href, window.location.href)
      if (nextUrl.origin !== window.location.origin) return

      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (nextPath === currentPath) return

      event.preventDefault()
      setPendingPath(nextPath)
      setShowUnsavedDialog(true)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [hasUnsavedChanges])

  const handleKeepEditing = useCallback(() => {
    setShowUnsavedDialog(false)
    setPendingPath(null)
  }, [])

  const handleDiscardAndLeave = useCallback(() => {
    const destination = pendingPath
    setShowUnsavedDialog(false)
    setPendingPath(null)
    if (destination) onNavigate(destination)
  }, [onNavigate, pendingPath])

  return {
    showUnsavedDialog,
    setShowUnsavedDialog,
    pendingPath,
    setPendingPath,
    navigateWithUnsavedGuard,
    handleKeepEditing,
    handleDiscardAndLeave,
  }
}
