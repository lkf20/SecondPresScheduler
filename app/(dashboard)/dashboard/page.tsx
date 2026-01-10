import Link from 'next/link'
import { headers } from 'next/headers'
import { Card, CardContent } from '@/components/ui/card'

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

const formatRangeLabel = (start: Date, end: Date) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start) +
  ' - ' +
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(end)

const getBaseUrl = async () => {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') || headerList.get('host')
  const protocol = headerList.get('x-forwarded-proto') || 'http'
  if (!host) return ''
  return `${protocol}://${host}`
}

const fetchSummary = async (startDate: string, endDate: string) => {
  const baseUrl = await getBaseUrl()
  const url = baseUrl
    ? `${baseUrl}/api/dashboard/coverage-summary?start_date=${startDate}&end_date=${endDate}`
    : `/api/dashboard/coverage-summary?start_date=${startDate}&end_date=${endDate}`
  const response = await fetch(url, { cache: 'no-store' })
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || !contentType.includes('application/json')) {
    return {
      absences: 0,
      uncovered_shifts: 0,
      partially_covered_shifts: 0,
      scheduled_subs: 0,
    }
  }
  return response.json()
}

export default async function DashboardPage() {
  const today = new Date()
  const startDate = toDateString(today)
  const endDateDate = addDays(today, 13)
  const endDate = toDateString(endDateDate)
  const summary = await fetchSummary(startDate, endDate)
  const rangeLabel = formatRangeLabel(today, endDateDate)

  const summaryItems = [
    {
      label: 'Uncovered shifts',
      count: summary.uncovered_shifts ?? 0,
      href: '#uncovered-shifts',
    },
    {
      label: 'Partially covered',
      count: summary.partially_covered_shifts ?? 0,
      href: '#partially-covered',
    },
    {
      label: 'Absences',
      count: summary.absences ?? 0,
      href: '#absences',
    },
    {
      label: 'Scheduled subs',
      count: summary.scheduled_subs ?? 0,
      href: '#scheduled-subs',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">
            Coverage outlook: {rangeLabel}
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {summaryItems.map((item) => (
            <Link key={item.label} href={item.href} className="block">
              <Card className="hover:bg-accent transition-colors">
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="text-2xl font-semibold text-slate-900 mt-1">{item.count}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10 space-y-8">
        <div id="uncovered-shifts" className="min-h-[80px]" />
        <div id="partially-covered" className="min-h-[80px]" />
        <div id="absences" className="min-h-[80px]" />
        <div id="scheduled-subs" className="min-h-[80px]" />
      </section>
    </div>
  )
}
