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
  if (!schoolId) {
    throw new Error('SchoolProvider requires a non-null schoolId. User must have a profile with school_id.')
  }

  return (
    <SchoolContext.Provider value={{ schoolId }}>
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool(): string {
  const context = useContext(SchoolContext)
  if (context === undefined) {
    throw new Error('useSchool must be used within a SchoolProvider')
  }
  return context.schoolId
}
