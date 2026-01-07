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
  const [justCreated, setJustCreated] = useState(false)

  useEffect(() => {
    checkProfile()
  }, [])

  const checkProfile = async () => {
    setChecking(true)
    setError(null)
    try {
      const response = await fetch('/api/setup/profile')
      
      // If response is not ok, check if it's an auth issue
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        // If user is not authenticated, just show "no profile" - don't treat as error
        if (response.status === 401) {
          setHasProfile(false)
          return
        }
        // For other errors, log but don't show to user - assume no profile
        console.error('Error checking profile:', data.error)
        setHasProfile(false)
        return
      }

      const data = await response.json()
      setHasProfile(data.has_profile)
      if (data.profile) {
        setProfile(data.profile)
      }
    } catch (err) {
      // Network or other errors - don't show error, just assume no profile
      console.error('Error checking profile:', err)
      setHasProfile(false)
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
        setJustCreated(true) // Mark that we just created it
      } else {
        // Show the specific error message from the API
        const errorMessage = data.error || 'Unable to create profile. Please try again.'
        setError(errorMessage)
        console.error('Profile creation failed:', data)
      }
    } catch (err) {
      // Network or other unexpected errors
      console.error('Unexpected error creating profile:', err)
      setError('Unable to connect to the server. Please check your connection and try again.')
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
                <span className="font-medium">
                  {justCreated ? 'Profile created successfully!' : 'Profile already exists'}
                </span>
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
              <p className="text-sm text-red-800 font-medium">Unable to create profile</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
              <p className="text-xs text-red-600 mt-2">
                Please check the browser console for more details or contact support if this issue persists.
              </p>
            </div>
          )}

          {success && justCreated && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                Your profile has been set up. You can now use all features that require school context.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

