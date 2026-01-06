import { notFound } from 'next/navigation'
import { getClassGroupById } from '@/lib/api/class-groups'
import ClassFormClient from './ClassFormClient'

export default async function ClassDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  let classData
  try {
    classData = await getClassGroupById(id)
  } catch (error) {
    notFound()
  }

  return <ClassFormClient classData={classData} />
}
