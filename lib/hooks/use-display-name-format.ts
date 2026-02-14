'use client'

import { useEffect, useState } from 'react'
import type { DisplayNameFormat } from '@/lib/utils/staff-display-name'
import { useDisplayNameFormatContext } from '@/lib/contexts/DisplayNameFormatContext'

type ScheduleSettingsResponse = {
  default_display_name_format?: DisplayNameFormat
}

export function useDisplayNameFormat() {
  const context = useDisplayNameFormatContext()
  const initialFormat = context?.defaultFormat
  const [format, setFormat] = useState<DisplayNameFormat>(initialFormat ?? 'first_last_initial')
  const [isLoaded, setIsLoaded] = useState(Boolean(initialFormat))

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/schedule-settings')
        if (!response.ok) return
        const data = (await response.json()) as ScheduleSettingsResponse
        if (data?.default_display_name_format) {
          setFormat(data.default_display_name_format)
        }
      } catch (err) {
        console.error('Failed to fetch schedule settings', err)
      } finally {
        setIsLoaded(true)
      }
    }

    fetchSettings()
  }, [])

  return { format, isLoaded }
}
