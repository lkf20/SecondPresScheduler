'use client'

type ClientLogoutOptions = {
  signOut: () => Promise<unknown>
  clearQueryCache?: () => void
  clearStorage?: () => void
  redirect?: (path: string) => void
  redirectTo?: string
}

const defaultClearStorage = () => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.clear()
  } catch {
    // no-op
  }
  try {
    window.sessionStorage.clear()
  } catch {
    // no-op
  }
}

const defaultRedirect = (path: string) => {
  if (typeof window === 'undefined') return
  window.location.assign(path)
}

export async function performClientLogout({
  signOut,
  clearQueryCache,
  clearStorage = defaultClearStorage,
  redirect = defaultRedirect,
  redirectTo = '/login',
}: ClientLogoutOptions) {
  let signOutError: unknown = null
  try {
    await signOut()
  } catch (error) {
    signOutError = error
  } finally {
    clearQueryCache?.()
    clearStorage()
    redirect(redirectTo)
  }

  void signOutError
}
