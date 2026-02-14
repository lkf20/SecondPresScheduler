'use client'

import { createContext, useContext } from 'react'
import type { DisplayNameFormat } from '@/lib/utils/staff-display-name'

interface DisplayNameFormatContextValue {
  defaultFormat: DisplayNameFormat
}

const DisplayNameFormatContext = createContext<DisplayNameFormatContextValue | undefined>(undefined)

export function DisplayNameFormatProvider({
  children,
  defaultFormat,
}: {
  children: React.ReactNode
  defaultFormat: DisplayNameFormat
}) {
  return (
    <DisplayNameFormatContext.Provider value={{ defaultFormat }}>
      {children}
    </DisplayNameFormatContext.Provider>
  )
}

export function useDisplayNameFormatContext() {
  return useContext(DisplayNameFormatContext)
}
