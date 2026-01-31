import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Header from './Header'
import Sidebar from './Sidebar'
import { Toaster } from 'sonner'
import { PanelManagerProvider } from '@/lib/contexts/PanelManagerContext'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
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
    <PanelManagerProvider>
      <div className="min-h-screen bg-slate-50/70">
        <Header userEmail={user.email || undefined} />
        <Sidebar />
        <main className="md:pl-[var(--sidebar-current-width)] pt-16">
          <div className="container mx-auto px-4 py-4 md:pl-8">{children}</div>
        </main>
        <Toaster position="top-right" />
      </div>
    </PanelManagerProvider>
  )
}
