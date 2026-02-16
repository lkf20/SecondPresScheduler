import { ActivityFeed } from '@/components/activity/ActivityFeed'

export default function ActivityPage() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Activity</h1>
        <p className="text-sm text-slate-600">
          Recent changes made by your team across scheduling and coverage.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <ActivityFeed className="min-h-[65vh]" />
      </div>
    </div>
  )
}
