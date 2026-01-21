'use client'

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'

type PanelType = 'contact-sub' | 'schedule' | 'time-off' | null

interface PanelState {
  type: PanelType
  restoreCallback?: () => void
}

interface PanelManagerContextType {
  activePanel: PanelType
  previousPanel: PanelState | null
  setActivePanel: (panel: PanelType, restoreCallback?: () => void) => void
  savePreviousPanel: (panel: PanelType, restoreCallback?: () => void) => void
  restorePreviousPanel: () => void
  clearPreviousPanel: () => void
  requestPanelClose: (panel: PanelType) => void
  registerPanelCloseHandler: (panel: PanelType, handler: () => void) => () => void
}

const PanelManagerContext = createContext<PanelManagerContextType | undefined>(undefined)

export function PanelManagerProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanelState] = useState<PanelType>(null)
  const [previousPanel, setPreviousPanel] = useState<PanelState | null>(null)
  const closeRequestCallbacksRef = useRef<Map<PanelType, () => void>>(new Map())

  const setActivePanel = useCallback((panel: PanelType, restoreCallback?: () => void) => {
    setActivePanelState(panel)
    if (restoreCallback) {
      setPreviousPanel({ type: panel, restoreCallback })
    }
  }, [])

  const savePreviousPanel = useCallback((panel: PanelType, restoreCallback?: () => void) => {
    if (panel && panel !== 'time-off') {
      setPreviousPanel({ type: panel, restoreCallback })
    }
  }, [])

  const restorePreviousPanel = useCallback(() => {
    if (previousPanel?.restoreCallback) {
      previousPanel.restoreCallback()
      setPreviousPanel(null)
    }
  }, [previousPanel])

  const clearPreviousPanel = useCallback(() => {
    setPreviousPanel(null)
  }, [])

  const requestPanelClose = useCallback((panel: PanelType) => {
    const callback = closeRequestCallbacksRef.current.get(panel)
    if (callback) {
      callback()
    }
  }, [])

  const registerPanelCloseHandler = useCallback((panel: PanelType, handler: () => void) => {
    closeRequestCallbacksRef.current.set(panel, handler)
    return () => {
      closeRequestCallbacksRef.current.delete(panel)
    }
  }, [])

  return (
    <PanelManagerContext.Provider
      value={{
        activePanel,
        previousPanel,
        setActivePanel,
        savePreviousPanel,
        restorePreviousPanel,
        clearPreviousPanel,
        requestPanelClose,
        registerPanelCloseHandler,
      }}
    >
      {children}
    </PanelManagerContext.Provider>
  )
}

export function usePanelManager() {
  const context = useContext(PanelManagerContext)
  if (context === undefined) {
    throw new Error('usePanelManager must be used within a PanelManagerProvider')
  }
  return context
}
