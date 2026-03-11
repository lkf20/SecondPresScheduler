const path = require('path')
const fs = require('fs')
const { test: setup, expect } = require('@playwright/test')

const authDir = path.join(__dirname, '.auth')
const authFile = path.join(authDir, 'user.json')

function hasE2ECredentials() {
  return Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD)
}

setup('authenticate', async ({ page }) => {
  if (!hasE2ECredentials()) {
    fs.mkdirSync(authDir, { recursive: true })
    fs.writeFileSync(authFile, JSON.stringify({ cookies: [], origins: [] }))
    return
  }

  // Reuse existing state from a previous run (e.g. manual capture) so we don't fail when automated login never redirects
  if (fs.existsSync(authFile)) {
    try {
      const state = JSON.parse(fs.readFileSync(authFile, 'utf8'))
      if (
        (state.cookies && state.cookies.length > 0) ||
        (state.origins && state.origins.length > 0)
      ) {
        return
      }
    } catch (_) {
      // invalid or empty; fall through to login
    }
  }

  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForLoadState('domcontentloaded')

  const signInButton = page.getByRole('button', { name: /sign in/i })
  await signInButton.waitFor({ state: 'visible' })
  await page.getByPlaceholder('Email address').fill(process.env.E2E_TEST_EMAIL)
  await page.getByPlaceholder('Password').fill(process.env.E2E_TEST_PASSWORD)
  await signInButton.click()

  await expect
    .poll(async () => !new URL(page.url()).pathname.startsWith('/login'), { timeout: 45000 })
    .toBe(true)

  const pathname = new URL(page.url()).pathname
  if (pathname.startsWith('/login')) {
    const errorEl = page.locator('.text-red-800')
    const text = (await errorEl.isVisible().catch(() => false))
      ? await errorEl.first().textContent()
      : null
    throw new Error(
      text
        ? `Login failed: ${text.trim()}`
        : 'Login did not redirect. Check E2E_TEST_EMAIL, E2E_TEST_PASSWORD and Supabase config.'
    )
  }

  fs.mkdirSync(authDir, { recursive: true })
  await page.context().storageState({ path: authFile })
})

/**
 * Manual auth capture: run with --headed, log in when the browser pauses, then resume.
 * Use when automated login never redirects (e.g. local Supabase/cookies).
 *
 *   E2E_AUTH_MANUAL=1 npx playwright test tests/e2e/auth.setup.js -g "authenticate-manual" --headed
 *
 * When the browser opens at /login, log in with E2E_TEST_EMAIL / E2E_TEST_PASSWORD,
 * then in the Playwright inspector click Resume. The test will save storage state for future runs.
 */
setup('authenticate-manual', async ({ page }) => {
  setup.skip(!process.env.E2E_AUTH_MANUAL, 'Set E2E_AUTH_MANUAL=1 to run manual auth capture')
  await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.pause()
  const pathname = new URL(page.url()).pathname
  if (pathname.startsWith('/login')) {
    throw new Error('Still on /login after resume. Log in in the browser before clicking Resume.')
  }
  fs.mkdirSync(authDir, { recursive: true })
  await page.context().storageState({ path: authFile })
})
