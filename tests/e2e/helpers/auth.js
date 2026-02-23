const { expect } = require('@playwright/test')

function hasE2ECredentials() {
  return Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD)
}

async function ensureAuthenticated(page, targetPath = '/dashboard') {
  await page.goto(targetPath)

  const currentPath = new URL(page.url()).pathname
  if (!currentPath.startsWith('/login')) {
    return
  }

  if (!hasE2ECredentials()) {
    throw new Error('E2E credentials are required to authenticate protected routes')
  }

  await page.getByPlaceholder('Email address').fill(process.env.E2E_TEST_EMAIL)
  await page.getByPlaceholder('Password').fill(process.env.E2E_TEST_PASSWORD)

  await Promise.all([
    page.waitForURL(url => !url.pathname.startsWith('/login')),
    page.getByRole('button', { name: /sign in/i }).click(),
  ])

  await page.goto(targetPath)
  await expect(page).not.toHaveURL(/\/login/)
}

module.exports = {
  ensureAuthenticated,
  hasE2ECredentials,
}
