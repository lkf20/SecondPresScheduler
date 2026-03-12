'use client'

import { useState, useEffect } from 'react'

/**
 * Shows which Supabase environment (staging vs production) the app is using.
 * Only visible in development (localhost) so you don't accidentally edit production data.
 *
 * Set in .env.local:
 *   NEXT_PUBLIC_SUPABASE_ENV=staging   (or production)
 * If unset, the badge shows "(not set)".
 */
export default function SupabaseEnvBadge() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    setShow(
      process.env.NODE_ENV === 'development' ||
        (typeof window !== 'undefined' && window.location?.hostname === 'localhost')
    )
  }, [])

  if (!show) return null

  const env = process.env.NEXT_PUBLIC_SUPABASE_ENV?.trim().toLowerCase()
  const label =
    env === 'staging'
      ? 'Supabase: Staging'
      : env === 'production' || env === 'prod'
        ? 'Supabase: Production'
        : 'Supabase: (not set)'

  const isStaging = env === 'staging'
  const isProduction = env === 'production' || env === 'prod'
  const isUnknown = !isStaging && !isProduction

  return (
    <div
      className="fixed bottom-3 right-3 z-[9999] pointer-events-none select-none"
      title={
        isUnknown
          ? 'Set NEXT_PUBLIC_SUPABASE_ENV=staging or production in .env.local'
          : `Connected to Supabase ${isProduction ? 'Production' : 'Staging'}`
      }
    >
      <span
        className={[
          'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium shadow-sm',
          isStaging &&
            'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-200',
          isProduction &&
            'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200',
          isUnknown &&
            'border-amber-200 bg-amber-50/80 text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {label}
      </span>
    </div>
  )
}
