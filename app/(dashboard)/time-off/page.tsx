import TimeOffListClient from './TimeOffListClient'
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
