const { expect } = require('@playwright/test')

function hasE2ECredentials() {
  return Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD)
}

async function ensureAuthenticated(page, targetPath = '/dashboard') {
  // Use 'domcontentloaded' to avoid ERR_ABORTED when middleware redirects
  // unauthenticated users to /login (the redirect can abort the original nav)
  const gotoOpts = { waitUntil: 'domcontentloaded', timeout: 30000 }

  await page.goto(targetPath, gotoOpts)

  const currentPath = new URL(page.url()).pathname
  if (!currentPath.startsWith('/login')) {
    return
  }

  if (!hasE2ECredentials()) {
    throw new Error('E2E credentials are required to authenticate protected routes')
  }

  // Wait for DOM so React has hydrated and form handlers are attached (avoid full 'load'
  // which can hang on slow resources or when redirect is client-side).
  await page.waitForLoadState('domcontentloaded')

  const signInButton = page.getByRole('button', { name: /sign in/i })
  await signInButton.waitFor({ state: 'visible' })
  await page.getByPlaceholder('Email address').fill(process.env.E2E_TEST_EMAIL)
  await page.getByPlaceholder('Password').fill(process.env.E2E_TEST_PASSWORD)

  await signInButton.click()

  // Wait for URL to leave /login. Client-side router.push doesn't fire a full "load" event,
  // so page.waitForURL(..., 'load') can hang; polling the URL is more reliable.
  try {
    await page.waitForFunction(() => !window.location.pathname.startsWith('/login'), {
      timeout: 45000,
    })
  } catch (e) {
    const errorEl = page.locator('.text-red-800')
    if (await errorEl.isVisible().catch(() => false)) {
      const text = await errorEl.first().textContent()
      throw new Error(
        `Login failed: ${(text || '').trim() || 'check E2E_TEST_EMAIL and E2E_TEST_PASSWORD'}`
      )
    }
    throw new Error(
      'Login did not redirect away from /login. The sign-in click ran but the URL never changed. ' +
        'Try: (1) Log in manually at http://127.0.0.1:3000/login with E2E_TEST_EMAIL and E2E_TEST_PASSWORD. ' +
        '(2) Ensure .env.local has the same Supabase URL/key as the running app. ' +
        '(3) Run with --headed to watch: npx playwright test --grep @smoke --headed'
    )
  }

  // Post-login navigation: use 'commit' for heavy pages (weekly, sub-finder) so we don't
  // timeout waiting for full DOM; test assertions will wait for elements.
  await page.goto(targetPath, {
    waitUntil: 'commit',
    timeout: 30000,
  })
  await expect(page).not.toHaveURL(/\/login/)
}

/**
 * Navigate to a path using the session from auth setup (storage state).
 * Use this in tests that run in the project with storageState; the setup runs login once.
 * If the session is missing or expired, the app will redirect to /login and this will throw.
 */
async function gotoWithAuth(page, targetPath, options = {}) {
  await page.goto(targetPath, {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
    ...options,
  })
  const onLogin = /\/login/.test(new URL(page.url()).pathname)
  if (onLogin) {
    throw new Error(
      `Expected to be logged in but landed on /login. Re-run with E2E_TEST_EMAIL and E2E_TEST_PASSWORD set so auth setup can save a session.`
    )
  }
}

module.exports = {
  ensureAuthenticated,
  gotoWithAuth,
  hasE2ECredentials,
}
