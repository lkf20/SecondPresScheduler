'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

export default function SetupProfilePage() {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    checkProfile()
  }, [])

  const checkProfile = async () => {
    setChecking(true)
    setError(null)
    try {
      const response = await fetch('/api/setup/profile')
      const data = await response.json()

      if (response.ok) {
        setHasProfile(data.has_profile)
        if (data.profile) {
          setProfile(data.profile)
        }
      } else {
        setError(data.error || 'Failed to check profile status')
      }
    } catch (err) {
      setError('Failed to check profile status')
      console.error(err)
    } finally {
      setChecking(false)
    }
  }

  const createProfile = async () => {
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch('/api/setup/profile', {
        method: 'POST',
      })
      const data = await response.json()

      if (response.ok) {
        setSuccess(true)
        setHasProfile(true)
        setProfile(data.profile)
      } else {
        setError(data.error || 'Failed to create profile')
      }
    } catch (err) {
      setError('Failed to create profile')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="container mx-auto py-10">
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Checking profile status...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Profile Setup</CardTitle>
          <CardDescription>
            Set up your user profile to link your account to a school
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasProfile ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Profile already exists</span>
              </div>
              {profile && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">School:</span>{' '}
                    <span className="text-sm">
                      {(profile.schools as any)?.name || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Role:</span>{' '}
                    <span className="text-sm capitalize">{profile.role}</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Created:</span>{' '}
                    <span className="text-sm">
                      {new Date(profile.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-amber-600">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">No profile found</span>
              </div>
              <p className="text-sm text-muted-foreground">
                You need to create a profile to link your account to a school. This will allow you
                to use features that require school context, such as audit logging.
              </p>
              <Button onClick={createProfile} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Profile...
                  </>
                ) : (
                  'Create Profile'
                )}
              </Button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                Profile created successfully! You can now use all features.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

