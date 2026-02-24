'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import FormField from '@/components/shared/FormField'
import ErrorMessage from '@/components/shared/ErrorMessage'
import StaffUnsavedChangesDialog from '@/components/staff/StaffUnsavedChangesDialog'
import { Database } from '@/types/database'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useSchool } from '@/lib/contexts/SchoolContext'
import {
  invalidateDailySchedule,
  invalidateDashboard,
  invalidateSubFinderAbsences,
  invalidateTimeOffRequests,
  invalidateWeeklySchedule,
} from '@/lib/utils/invalidation'

type TimeSlot = Database['public']['Tables']['time_slots']['Row']

const timeSlotSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  name: z.string().optional(),
  default_start_time: z.string().optional(),
  default_end_time: z.string().optional(),
  is_active: z.boolean().default(true),
})

type TimeSlotFormInput = z.input<typeof timeSlotSchema>

interface TimeSlotFormProps {
  mode: 'create' | 'edit'
  timeSlot?: TimeSlot
  showInactiveBaselineWarning?: boolean
}

type TimeSlotSnapshot = {
  code: string
  name: string
  default_start_time: string
  default_end_time: string
  is_active: boolean
}

const normalizeTimeValue = (value: unknown): string => {
  if (typeof value !== 'string' || value.trim() === '') return ''
  const trimmed = value.trim()
  // Normalize DB-style HH:mm:ss to input-style HH:mm for reliable dirty checking.
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed
}

export default function TimeSlotForm({
  mode,
  timeSlot,
  showInactiveBaselineWarning = false,
}: TimeSlotFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const schoolId = useSchool()
  const isEdit = mode === 'edit'
  const formId = `timeslot-form-${isEdit ? (timeSlot?.id ?? 'edit') : 'new'}`

  if (isEdit && !timeSlot) {
    throw new Error('timeSlot is required in edit mode')
  }

  const [error, setError] = useState<string | null>(null)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TimeSlotFormInput>({
    resolver: zodResolver(timeSlotSchema),
    defaultValues: {
      code: timeSlot?.code ?? '',
      name: timeSlot?.name ?? '',
      default_start_time: normalizeTimeValue(timeSlot?.default_start_time),
      default_end_time: normalizeTimeValue(timeSlot?.default_end_time),
      is_active: timeSlot?.is_active ?? true,
    },
  })

  const code = watch('code')
  const name = watch('name')
  const defaultStartTime = watch('default_start_time')
  const defaultEndTime = watch('default_end_time')
  const isActive = watch('is_active')

  const currentSnapshot = useMemo<TimeSlotSnapshot>(
    () => ({
      code: code?.trim() ?? '',
      name: name?.trim() ?? '',
      default_start_time: normalizeTimeValue(defaultStartTime),
      default_end_time: normalizeTimeValue(defaultEndTime),
      is_active: isActive ?? true,
    }),
    [code, name, defaultStartTime, defaultEndTime, isActive]
  )

  const baselineSnapshotRef = useRef<TimeSlotSnapshot>({
    code: timeSlot?.code?.trim() ?? '',
    name: timeSlot?.name?.trim() ?? '',
    default_start_time: normalizeTimeValue(timeSlot?.default_start_time),
    default_end_time: normalizeTimeValue(timeSlot?.default_end_time),
    is_active: timeSlot?.is_active ?? true,
  })

  useEffect(() => {
    baselineSnapshotRef.current = {
      code: timeSlot?.code?.trim() ?? '',
      name: timeSlot?.name?.trim() ?? '',
      default_start_time: normalizeTimeValue(timeSlot?.default_start_time),
      default_end_time: normalizeTimeValue(timeSlot?.default_end_time),
      is_active: timeSlot?.is_active ?? true,
    }
  }, [timeSlot])

  const hasUnsavedChanges =
    JSON.stringify(currentSnapshot) !== JSON.stringify(baselineSnapshotRef.current)

  const navigateWithUnsavedGuard = (path: string) => {
    if (hasUnsavedChanges) {
      setPendingPath(path)
      setShowUnsavedDialog(true)
      return
    }
    router.push(path)
  }

  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (!target) return

      const anchor = target.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return

      const nextUrl = new URL(anchor.href, window.location.href)
      if (nextUrl.origin !== window.location.origin) return

      const nextPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (nextPath === currentPath) return

      event.preventDefault()
      setPendingPath(nextPath)
      setShowUnsavedDialog(true)
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [hasUnsavedChanges])

  const handleDiscardAndLeave = () => {
    const destination = pendingPath
    setShowUnsavedDialog(false)
    setPendingPath(null)
    if (destination) {
      router.push(destination)
    }
  }

  const invalidateAfterSave = async () => {
    await Promise.all([
      invalidateWeeklySchedule(queryClient, schoolId),
      invalidateDailySchedule(queryClient, schoolId),
      invalidateDashboard(queryClient, schoolId),
      invalidateTimeOffRequests(queryClient, schoolId),
      invalidateSubFinderAbsences(queryClient, schoolId),
      queryClient.invalidateQueries({ queryKey: ['filterOptions', schoolId] }),
      queryClient.invalidateQueries({ queryKey: ['filterOptions'] }),
      queryClient.invalidateQueries({ queryKey: ['dailySchedule'] }),
      queryClient.invalidateQueries({ queryKey: ['weeklySchedule'] }),
      queryClient.invalidateQueries({ queryKey: ['scheduleSettings'] }),
    ])
  }

  const onSubmit = async (data: TimeSlotFormInput) => {
    try {
      setError(null)

      const payload = {
        code: data.code,
        name: data.name || null,
        default_start_time: data.default_start_time || null,
        default_end_time: data.default_end_time || null,
        is_active: data.is_active ?? true,
      }

      const url = isEdit ? `/api/timeslots/${timeSlot!.id}` : '/api/timeslots'
      const method = isEdit ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${isEdit ? 'update' : 'create'} time slot`)
      }

      const timeSlotName = (payload.name && payload.name.trim()) || payload.code || 'Time slot'
      toast.success(isEdit ? `${timeSlotName} updated.` : `${timeSlotName} created.`)
      await invalidateAfterSave()
      router.push('/settings/timeslots')
      router.refresh()
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : `Failed to ${isEdit ? 'update' : 'create'} time slot`
      )
    }
  }

  return (
    <div>
      <div className="mb-4">
        <button
          type="button"
          onClick={() => navigateWithUnsavedGuard('/settings/timeslots')}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Days & Time Slots
        </button>
      </div>

      <div className="mb-8 max-w-2xl">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {isEdit ? name?.trim() || code?.trim() || 'Time Slot' : 'Add Time Slot'}
            </h1>
            {hasUnsavedChanges && (
              <>
                <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Unsaved changes
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-teal-700 hover:bg-transparent hover:text-teal-800"
                  type="submit"
                  form={formId}
                >
                  Save
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Label htmlFor="is_active" className="font-normal cursor-pointer">
              {isActive ? 'Active' : 'Inactive'}
            </Label>
            <Switch
              id="is_active"
              checked={isActive}
              onCheckedChange={checked => setValue('is_active', checked === true)}
            />
          </div>
        </div>
        <p className="text-muted-foreground mt-2">
          {isActive
            ? 'Active time slots will appear in schedules and dropdowns.'
            : 'Inactive time slots will not appear in dropdowns but historical data is preserved.'}
        </p>
        {!isActive && showInactiveBaselineWarning && (
          <Alert className="mt-3 border-amber-200 bg-amber-50 text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              This time slot is marked as inactive but still appears in the baseline schedule.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <div className="max-w-2xl">
        <div className="rounded-lg border bg-white p-6">
          <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <FormField label="Code" error={errors.code?.message} required>
              <Input {...register('code')} placeholder="e.g. AM, PM, EM, LB" />
            </FormField>

            <FormField label="Name" error={errors.name?.message}>
              <Input {...register('name')} placeholder="Optional" />
            </FormField>

            <FormField label="Default Start Time" error={errors.default_start_time?.message}>
              <Input type="time" {...register('default_start_time')} placeholder="Optional" />
            </FormField>

            <FormField label="Default End Time" error={errors.default_end_time?.message}>
              <Input type="time" {...register('default_end_time')} placeholder="Optional" />
            </FormField>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigateWithUnsavedGuard('/settings/timeslots')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || (isEdit && !hasUnsavedChanges)}>
                {isSubmitting
                  ? isEdit
                    ? 'Updating...'
                    : 'Creating...'
                  : isEdit
                    ? 'Update'
                    : 'Create'}
              </Button>
            </div>
          </form>
        </div>
      </div>

      <StaffUnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onKeepEditing={() => {
          setShowUnsavedDialog(false)
          setPendingPath(null)
        }}
        onDiscardAndLeave={handleDiscardAndLeave}
      />
    </div>
  )
}
