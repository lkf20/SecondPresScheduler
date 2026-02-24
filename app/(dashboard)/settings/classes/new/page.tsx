import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ClassGroupForm from '@/components/settings/ClassGroupForm'

export default function NewClassPage() {
  return (
    <div>
      <div className="mb-4">
        <Link
          href="/settings/classes"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Class Groups
        </Link>
      </div>
      <ClassGroupForm mode="create" />
    </div>
  )
}
