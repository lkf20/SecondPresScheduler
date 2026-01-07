import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Header from './Header'
import Sidebar from './Sidebar'
import { Toaster } from 'sonner'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.error('AppLayout auth error:', error.message)
      redirect('/login')
    }

    if (!user) {
      redirect('/login')
    }

    return (
      <div className="min-h-screen bg-background">
        <Header userEmail={user.email || undefined} />
        <Sidebar />
        <main className="md:pl-64 pt-16">
          <div className="container mx-auto px-4 py-6">
            {children}
          </div>
        </main>
        <Toaster position="top-right" />
      </div>
    )
  } catch (error: any) {
    console.error('AppLayout error:', error)
    redirect('/login')
  }
}

