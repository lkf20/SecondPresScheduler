'use client'

import React, { createContext, useContext } from 'react'

interface SchoolContextType {
  schoolId: string
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined)

export function SchoolProvider({
  children,
  schoolId,
}: {
  children: React.ReactNode
  schoolId: string | null
}) {
  // If schoolId is null, provide a placeholder value to prevent crashes
  // Components using useSchool() will need to handle the error case
  const contextValue = schoolId ? { schoolId } : { schoolId: '' }

  return (
    <SchoolContext.Provider value={contextValue as SchoolContextType}>
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool(): string {
  const context = useContext(SchoolContext)
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider')
  }
  if (!context.schoolId) {
    throw new Error('User profile is missing school_id. Please complete your profile setup.')
  }
  return context.schoolId
}
