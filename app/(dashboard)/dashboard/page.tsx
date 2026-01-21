import { headers } from 'next/headers'
import DashboardClient from './DashboardClient'

const toDateString = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const fetchOverview = async (startDate: string, endDate: string) => {
  try {
    const headersList = await headers()
    const host = headersList.get('host') || 'localhost:3001'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const url = `${protocol}://${host}/api/dashboard/overview?start_date=${startDate}&end_date=${endDate}`
    
    const response = await fetch(url, {
      next: { revalidate: 0 }, // Don't cache for debugging
      headers: {
        cookie: headersList.get('cookie') || '',
      },
    })
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: errorText || `Failed to load dashboard data. Status ${response.status}.` }
      }
      return { error: errorData?.error || `Failed to load dashboard data. Status ${response.status}.` }
    }
    
    return await response.json()
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to load dashboard data. Please try again.',
    }
  }
}

export default async function DashboardPage() {
  try {
    const today = new Date()
    const startDate = toDateString(today)
    const endDateDate = addDays(today, 13)
    const endDate = toDateString(endDateDate)
    const overview = await fetchOverview(startDate, endDate)
    
    return (
      <div>
        {overview && !('error' in overview) ? (
          <DashboardClient
            overview={overview}
            startDate={startDate}
            endDate={endDate}
          />
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {overview && 'error' in overview
              ? overview.error
              : 'Dashboard data is unavailable right now. Please try again.'}
          </div>
        )}
      </div>
    )
  } catch (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        An error occurred while loading the dashboard: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    )
  }
}
