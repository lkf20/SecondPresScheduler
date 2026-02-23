const { expect, test } = require('@playwright/test')

test('login page renders @smoke', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('heading', { name: /scheduler login/i })).toBeVisible()
  await expect(page.getByPlaceholder('Email address')).toBeVisible()
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
})
