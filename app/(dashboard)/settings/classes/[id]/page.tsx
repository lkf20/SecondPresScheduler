import { notFound } from 'next/navigation'
import { getClassById } from '@/lib/api/classes'
import ClassFormClient from './ClassFormClient'

export default async function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  let classData
  try {
    classData = await getClassById(id)
  } catch (error) {
    notFound()
  }

  return <ClassFormClient classData={classData} />
}

