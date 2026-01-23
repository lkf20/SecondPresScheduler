import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { ThemeProvider } from '@/lib/contexts/ThemeContext'
import { SchoolProvider } from '@/lib/contexts/SchoolContext'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { createClient } from '@/lib/supabase/server'
import { getUserSchoolId } from '@/lib/utils/auth'

export const metadata: Metadata = {
  title: 'Scheduler App',
  description: 'Substitute teacher scheduling system',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  let initialTheme: 'system' | 'accented' = 'accented' // Default to accented
  let schoolId: string | null = null

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('theme, school_id')
        .eq('user_id', user.id)
        .single()
      // Use profile theme if set, otherwise default to accented
      if (profile?.theme) {
        initialTheme = profile.theme as 'system' | 'accented'
      }
      // Get schoolId from profile
      if (profile?.school_id) {
        schoolId = profile.school_id
      }
    }
  } catch (error) {
    console.error('RootLayout theme/school lookup failed:', error)
  }

  // If schoolId is not available, try getUserSchoolId as fallback
  if (!schoolId) {
    try {
      schoolId = await getUserSchoolId()
    } catch (error) {
      console.error('RootLayout failed to get schoolId:', error)
    }
  }

  return (
    <html lang="en" data-theme={initialTheme}>
      <head>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var storedTheme = window.localStorage.getItem('theme');
                  if (storedTheme === 'accented' || storedTheme === 'system') {
                    document.documentElement.setAttribute('data-theme', storedTheme);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <QueryProvider>
          <SchoolProvider schoolId={schoolId}>
            <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
          </SchoolProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
