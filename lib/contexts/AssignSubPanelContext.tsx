'use client'

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

export interface AssignSubInitials {
  teacherId: string
  startDate: string
  endDate: string
}

interface AssignSubPanelContextType {
  /** Request to open Assign Sub panel with prefilled teacher and date range */
  requestOpenAssignSub: (initials: AssignSubInitials) => void
  /** Current open request (set when requestOpenAssignSub called, cleared when panel closes) */
  assignSubInitials: AssignSubInitials | null
  /** Clear the request (called when panel closes) */
  clearAssignSubRequest: () => void
}

const AssignSubPanelContext = createContext<AssignSubPanelContextType | undefined>(undefined)

export function AssignSubPanelProvider({ children }: { children: ReactNode }) {
  const [assignSubInitials, setAssignSubInitials] = useState<AssignSubInitials | null>(null)

  const requestOpenAssignSub = useCallback((initials: AssignSubInitials) => {
    setAssignSubInitials(initials)
  }, [])

  const clearAssignSubRequest = useCallback(() => {
    setAssignSubInitials(null)
  }, [])

  const value = useMemo(
    () => ({
      requestOpenAssignSub,
      assignSubInitials,
      clearAssignSubRequest,
    }),
    [requestOpenAssignSub, assignSubInitials, clearAssignSubRequest]
  )

  return <AssignSubPanelContext.Provider value={value}>{children}</AssignSubPanelContext.Provider>
}

export function useAssignSubPanel() {
  const context = useContext(AssignSubPanelContext)
  if (context === undefined) {
    throw new Error('useAssignSubPanel must be used within an AssignSubPanelProvider')
  }
  return context
}
