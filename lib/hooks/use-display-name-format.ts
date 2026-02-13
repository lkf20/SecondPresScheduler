'use client'

import { useEffect, useState } from 'react'
import type { DisplayNameFormat } from '@/lib/utils/staff-display-name'

type ScheduleSettingsResponse = {
  default_display_name_format?: DisplayNameFormat
}

export function useDisplayNameFormat() {
  const [format, setFormat] = useState<DisplayNameFormat>('first_last_initial')
  const [isLoaded, setIsLoaded] = useState(false)

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
