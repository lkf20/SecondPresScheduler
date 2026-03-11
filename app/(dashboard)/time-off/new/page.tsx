'use client'

import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Redirect /time-off/new to open the Add Time Off right-side panel.
 * Preserves teacher_id, start_date, end_date; Header opens the panel when it sees open_time_off=1.
 */
export default function NewTimeOffRedirectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const returnTo = searchParams.get('return_to')
    const base = returnTo === 'sub-finder' ? '/sub-finder' : '/time-off'
    const p = new URLSearchParams(searchParams.toString())
    p.set('open_time_off', '1')
    router.replace(`${base}?${p.toString()}`)
  }, [router, searchParams])

  return null
}
