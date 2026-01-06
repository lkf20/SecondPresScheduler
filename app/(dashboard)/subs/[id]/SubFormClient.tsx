'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import SubForm from '@/components/subs/SubForm'
import SubAvailabilitySection from '@/components/subs/SubAvailabilitySection'
import SubPreferencesSection from '@/components/subs/SubPreferencesSection'
import ErrorMessage from '@/components/shared/ErrorMessage'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Database } from '@/types/database'

type Staff = Database['public']['Tables']['staff']['Row']

interface SubFormClientProps {
  sub: Staff
}

export default function SubFormClient({ sub }: SubFormClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [allSubs, setAllSubs] = useState<Staff[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(-1)

  // Get return page and search from URL params
  const returnPage = searchParams.get('returnPage') || '1'
  const returnSearch = searchParams.get('returnSearch')

  // Fetch all subs to enable navigation
  useEffect(() => {
    fetch('/api/subs')
      .then(r => r.json())
      .then(data => {
        setAllSubs(data)
        // Find current sub's index
        const index = data.findIndex((s: Staff) => s.id === sub.id)
        setCurrentIndex(index)
      })
      .catch(err => {
        console.error('Error fetching subs for navigation:', err)
      })
  }, [sub.id])

  // Build return URL with preserved pagination
  const getReturnUrl = () => {
    const params = new URLSearchParams()
    if (returnPage !== '1') {
      params.set('page', returnPage)
    }
    if (returnSearch) {
      params.set('search', returnSearch)
    }
    const queryString = params.toString()
    return `/subs${queryString ? `?${queryString}` : ''}`
  }

  const handlePrevious = () => {
    if (currentIndex > 0 && allSubs[currentIndex - 1]) {
      router.push(`/subs/${allSubs[currentIndex - 1].id}`)
    }
  }

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < allSubs.length - 1 && allSubs[currentIndex + 1]) {
      router.push(`/subs/${allSubs[currentIndex + 1].id}`)
    }
  }

  const handleSubmit = async (data: any) => {
    try {
      setError(null)
      // Convert empty email to null
      const payload = {
        ...data,
        email: data.email && data.email.trim() !== '' ? data.email : null,
        is_sub: true, // Always true when updating from sub form
        is_teacher: data.is_teacher ?? false, // Include the checkbox value
      }
      const response = await fetch(`/api/subs/${sub.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update sub')
      }

      router.push(getReturnUrl())
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this sub?')) return

    try {
      setError(null)
      const response = await fetch(`/api/subs/${sub.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete sub')
      }

      router.push(getReturnUrl())
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const subName = sub.display_name || `${sub.first_name} ${sub.last_name}`

  const hasPrevious = currentIndex > 0
  const hasNext = currentIndex >= 0 && currentIndex < allSubs.length - 1

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevious}
              disabled={!hasPrevious}
              title={
                hasPrevious
                  ? `Previous: ${allSubs[currentIndex - 1]?.display_name || `${allSubs[currentIndex - 1]?.first_name} ${allSubs[currentIndex - 1]?.last_name}`}`
                  : 'No previous sub'
              }
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">
              Edit Sub: <span className="text-primary">{subName}</span>
            </h1>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              disabled={!hasNext}
              title={
                hasNext
                  ? `Next: ${allSubs[currentIndex + 1]?.display_name || `${allSubs[currentIndex + 1]?.first_name} ${allSubs[currentIndex + 1]?.last_name}`}`
                  : 'No next sub'
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {currentIndex >= 0 && (
            <div className="text-sm text-muted-foreground">
              {currentIndex + 1} of {allSubs.length}
            </div>
          )}
        </div>
      </div>

      {error && <ErrorMessage message={error} className="mb-6" />}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="preferences">Preferences & Qualifications</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-2xl">
                <SubForm
                  sub={sub}
                  onSubmit={handleSubmit}
                  onCancel={() => router.push(getReturnUrl())}
                />
                <div className="mt-6 pt-6 border-t">
                  <button
                    onClick={handleDelete}
                    className="text-sm text-destructive hover:underline"
                  >
                    Delete Sub
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <SubAvailabilitySection subId={sub.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Preferences & Qualifications</CardTitle>
            </CardHeader>
            <CardContent>
              <SubPreferencesSection
                subId={sub.id}
                sub={{
                  can_change_diapers: sub.can_change_diapers,
                  can_lift_children: sub.can_lift_children,
                  can_assist_with_toileting: sub.can_assist_with_toileting,
                  capabilities_notes: sub.capabilities_notes,
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
