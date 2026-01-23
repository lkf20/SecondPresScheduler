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

const getBaseUrl = async () => {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') || headerList.get('host')
  const protocol = headerList.get('x-forwarded-proto') || 'http'
  if (!host) return ''
  return `${protocol}://${host}`
}

const fetchOverview = async (startDate: string, endDate: string) => {
  const baseUrl = await getBaseUrl()
  const headerList = await headers()
  const cookie = headerList.get('cookie')
  const url = baseUrl
    ? `${baseUrl}/api/dashboard/overview?start_date=${startDate}&end_date=${endDate}`
    : `/api/dashboard/overview?start_date=${startDate}&end_date=${endDate}`
  const response = await fetch(url, {
    next: { revalidate: 60 }, // Cache for 60 seconds, then revalidate
    headers: cookie ? { cookie } : undefined,
  })
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const fallbackText = await response.text().catch(() => '')
    const snippet = fallbackText.trim().slice(0, 200)
    return {
      error: `Dashboard data response was not JSON. Status ${response.status}. Content-Type ${contentType || 'unknown'}. URL ${response.url || url}. ${snippet || 'No body.'}`,
    }
  }
  const data = await response.json()
  if (!response.ok) {
    return { error: data?.error || `Failed to load dashboard data. Status ${response.status}.` }
  }
  return data
}

export default async function DashboardPage() {
  const today = new Date()
  const startDate = toDateString(today)
  const endDateDate = addDays(today, 13)
  const endDate = toDateString(endDateDate)
  const overview = await fetchOverview(startDate, endDate)
  return (
    <div className="w-full">
      {overview && !('error' in overview) ? (
        <DashboardClient overview={overview} startDate={startDate} endDate={endDate} />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {overview && 'error' in overview
            ? overview.error
            : 'Dashboard data is unavailable right now. Please try again.'}
        </div>
      )}
    </div>
  )
}
