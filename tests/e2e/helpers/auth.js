const { expect } = require('@playwright/test')

function hasE2ECredentials() {
  return Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD)
}

async function ensureAuthenticated(page, targetPath = '/dashboard') {
  // Use 'domcontentloaded' to avoid ERR_ABORTED when middleware redirects
  // unauthenticated users to /login (the redirect can abort the original nav)
  const gotoOpts = { waitUntil: 'domcontentloaded', timeout: 15000 }

  await page.goto(targetPath, gotoOpts)

  const currentPath = new URL(page.url()).pathname
  if (!currentPath.startsWith('/login')) {
    return
  }

  if (!hasE2ECredentials()) {
    throw new Error('E2E credentials are required to authenticate protected routes')
  }

  // Wait for page to finish loading so React has hydrated and form handlers are attached.
  // Without this, a click can trigger the native form submit (GET) before preventDefault runs.
  await page.waitForLoadState('load')

  const signInButton = page.getByRole('button', { name: /sign in/i })
  await signInButton.waitFor({ state: 'visible' })
  await page.getByPlaceholder('Email address').fill(process.env.E2E_TEST_EMAIL)
  await page.getByPlaceholder('Password').fill(process.env.E2E_TEST_PASSWORD)

  await Promise.all([
    page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 15000 }),
    signInButton.click(),
  ])

  // Post-login navigation: use 'commit' for heavy pages (weekly, sub-finder) so we don't
  // timeout waiting for full DOM; test assertions will wait for elements.
  await page.goto(targetPath, {
    waitUntil: 'commit',
    timeout: 30000,
  })
  await expect(page).not.toHaveURL(/\/login/)
}

module.exports = {
  ensureAuthenticated,
  hasE2ECredentials,
}
