/** @jest-environment jsdom */

import { performClientLogout } from '@/lib/auth/client-logout'

describe('performClientLogout', () => {
  it('signs out, clears query cache/storage, and redirects to login', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined)
    const clearQueryCache = jest.fn()
    const clearStorage = jest.fn()
    const redirect = jest.fn()

    await performClientLogout({
      signOut,
      clearQueryCache,
      clearStorage,
      redirect,
    })

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(clearQueryCache).toHaveBeenCalledTimes(1)
    expect(clearStorage).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('still clears cache/storage and redirects when sign out fails', async () => {
    const signOut = jest.fn().mockRejectedValue(new Error('sign-out failed'))
    const clearQueryCache = jest.fn()
    const clearStorage = jest.fn()
    const redirect = jest.fn()

    await performClientLogout({
      signOut,
      clearQueryCache,
      clearStorage,
      redirect,
      redirectTo: '/custom-login',
    })

    expect(signOut).toHaveBeenCalledTimes(1)
    expect(clearQueryCache).toHaveBeenCalledTimes(1)
    expect(clearStorage).toHaveBeenCalledTimes(1)
    expect(redirect).toHaveBeenCalledWith('/custom-login')
  })
})
