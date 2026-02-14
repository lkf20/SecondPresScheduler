import { redirect } from 'next/navigation'

export default async function SubDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const { id } = await params
  const query = (() => {
    if (!searchParams) return ''
    const pairs = Object.entries(searchParams).flatMap(([key, value]) => {
      if (value === undefined) return []
      return Array.isArray(value)
        ? value.map(item => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`)
        : [`${encodeURIComponent(key)}=${encodeURIComponent(value)}`]
    })
    return pairs.length > 0 ? `?${pairs.join('&')}` : ''
  })()

  redirect(`/staff/${id}${query}`)
}
