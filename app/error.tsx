'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-4 p-8">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Something went wrong!</h1>
        </div>
        <p className="text-gray-600">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        {error.digest && <p className="text-sm text-gray-500">Error ID: {error.digest}</p>}
        <div className="flex gap-4">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Button onClick={() => (window.location.href = '/')} variant="outline">
            Go home
          </Button>
        </div>
      </div>
    </div>
  )
}
