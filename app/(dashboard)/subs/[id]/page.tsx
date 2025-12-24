import { notFound } from 'next/navigation'
import { getSubById } from '@/lib/api/subs'
import SubFormClient from './SubFormClient'

export default async function SubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let sub
  try {
    sub = await getSubById(id)
  } catch (error) {
    notFound()
  }

  return <SubFormClient sub={sub} />
}

