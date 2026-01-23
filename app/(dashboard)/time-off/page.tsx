import TimeOffListClient from './TimeOffListClient'
import { cache } from 'react'
import { getUserSchoolId } from '@/lib/utils/auth'

// Cache the data fetching operation for SSR hydration
const getCachedTimeOffData = cache(async () => {
  const schoolId = await getUserSchoolId()
  if (!schoolId) {
    return { data: [], meta: { total: 0, filters: {} } }
  }

  // Use internal API call - the API route already does all the transformation
  const { getTimeOffRequests } = await import('@/lib/api/time-off')
  const requests = await getTimeOffRequests({ statuses: ['active', 'draft'] })

  // The API route returns transformed data, but we need to call it directly
  // For now, return the raw requests and let the client component use the API route
  // This is a temporary solution - ideally we'd call the API route transformation logic
  return { data: requests, meta: { total: requests.length, filters: {} } }
})

export const revalidate = 60 // Revalidate every 60 seconds

export default async function TimeOffPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string }>
}) {
  const params = await searchParams
  const view = params?.view ?? 'active'

  // For now, don't pass initial data - let React Query fetch it
  // This avoids duplicating the complex transformation logic
  // We can optimize later by sharing the transformation logic

  return (
    <div className="w-full max-w-4xl">
      <TimeOffListClient view={view} />
    </div>
  )
}
