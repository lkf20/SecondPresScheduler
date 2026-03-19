'use client'

import { useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { performClientLogout } from '@/lib/auth/client-logout'

export default function LogoutButton() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const handleLogout = async () => {
    await performClientLogout({
      signOut: () => supabase.auth.signOut(),
      clearQueryCache: () => queryClient.clear(),
    })
  }

  return (
    <button
      onClick={handleLogout}
      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      Logout
    </button>
  )
}
