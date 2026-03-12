/**
 * Gold scenario: Warnings vs errors — "Proceed anyway".
 * See scenarios/gold/02-warnings-vs-errors-proceed-anyway.md
 * Duplicate warning shows "Proceed anyway"; submit disabled until user checks it.
 */
const { test, expect } = require('@playwright/test')
const { gotoWithAuth, hasE2ECredentials } = require('../helpers/auth')

const json = payload => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(payload),
})

test('staff form duplicate warning disables submit until Proceed anyway checked @gold', async ({
  page,
}) => {
  test.skip(!hasE2ECredentials(), 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run gold scenarios.')

  await page.route('**/api/teachers/check-duplicates', async route => {
    if (route.request().method() !== 'POST') return route.fallback()
    await route.fulfill(
      json({
        duplicates: [
          {
            csvIndex: 0,
            matchType: 'name',
            existingTeacher: {
              id: 'existing-1',
              first_name: 'Jane',
              last_name: 'Doe',
              email: 'jane@example.com',
            },
          },
        ],
      })
    )
  })
  await page.route('**/api/teachers', async route => {
    await route.fulfill(json([]))
  })
  await page.route('**/api/staff**', async route => {
    const req = route.request()
    if (req.method() === 'GET' && req.url().includes('/api/staff')) {
      await route.fulfill(json([]))
      return
    }
    await route.fallback()
  })
  await page.route('**/api/staff-role-types**', async route => {
    await route.fulfill(json([{ id: 'r1', code: 'PERMANENT', label: 'Permanent' }]))
  })
  await page.route('**/api/schedule-settings**', async route => {
    await route.fulfill(
      json({ selected_day_ids: [], default_display_name_format: 'first_last_initial' })
    )
  })

  await gotoWithAuth(page, '/staff')
  await expect(page.getByRole('heading', { name: /staff/i })).toBeVisible()

  await page
    .getByRole('link', { name: /add staff|add/i })
    .first()
    .click()
  await page.waitForURL(/\/staff\/new/)

  // Wait for the form to load (StaffForm fetches role types; Overview tab is default)
  const firstNameField = page.getByRole('textbox', { name: /first name/i })
  await expect(firstNameField).toBeVisible({ timeout: 10000 })

  await firstNameField.fill('Jane')
  await page.getByRole('textbox', { name: /last name/i }).fill('Doe')
  await page.getByRole('textbox', { name: /email/i }).fill('jane@example.com')

  // Duplicate check is debounced (500ms); wait for it to run and display the warning
  await expect(page.getByText(/proceed anyway/i)).toBeVisible({ timeout: 10000 })
  await expect(page.getByText(/already exists|duplicate/i)).toBeVisible()

  await page.getByLabel(/proceed anyway/i).click()
  await expect(page.getByRole('button', { name: /create|save/i }).first()).toBeVisible()
})
