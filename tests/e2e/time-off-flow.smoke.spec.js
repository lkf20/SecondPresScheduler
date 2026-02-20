const { test, expect } = require('@playwright/test')
const { ensureAuthenticated, hasE2ECredentials } = require('./helpers/auth')

const json = payload => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(payload),
})

test('time off create and edit flow @smoke', async ({ page }) => {
  test.skip(
    !hasE2ECredentials(),
    'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run protected smoke flows.'
  )

  const teacher = {
    id: 'teacher-1',
    first_name: 'Bella',
    last_name: 'Wilbanks',
    display_name: 'Bella W.',
    active: true,
  }

  let timeOffRequests = [
    {
      id: 'req-1',
      teacher_id: teacher.id,
      teacher_name: 'Bella Wilbanks',
      start_date: '2099-01-08',
      end_date: '2099-01-08',
      status: 'active',
      coverage_status: 'needs_coverage',
      total: 1,
      covered: 0,
      partial: 0,
      uncovered: 1,
      shift_details: [{ label: 'Thu EM', status: 'uncovered' }],
      classrooms: [{ id: 'room-1', name: 'Infant Room', color: null }],
      reason: null,
      notes: null,
    },
  ]

  await page.route('**/api/teachers', async route => {
    await route.fulfill(json([teacher]))
  })

  await page.route('**/api/timeslots', async route => {
    await route.fulfill(
      json([
        { id: 'ts-em', code: 'EM', name: 'Early Morning', display_order: 1 },
        { id: 'ts-am', code: 'AM', name: 'Morning', display_order: 2 },
      ])
    )
  })

  await page.route('**/api/teachers/*/scheduled-shifts**', async route => {
    await route.fulfill(json([]))
  })

  await page.route('**/api/time-off/existing-shifts**', async route => {
    await route.fulfill(json({ shifts: [] }))
  })

  await page.route('**/api/time-off-requests**', async route => {
    await route.fulfill(
      json({
        data: timeOffRequests,
        meta: { total: timeOffRequests.length, filters: {} },
      })
    )
  })

  await page.route('**/api/time-off/*', async route => {
    const method = route.request().method()
    const url = new URL(route.request().url())
    const id = url.pathname.split('/').pop()

    if (method === 'GET') {
      const existing = timeOffRequests.find(request => request.id === id)
      if (!existing) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: '{"error":"Not found"}',
        })
        return
      }
      await route.fulfill(
        json({
          id: existing.id,
          teacher_id: existing.teacher_id,
          start_date: existing.start_date,
          end_date: existing.end_date,
          shift_selection_mode: 'all_scheduled',
          reason: existing.reason,
          notes: existing.notes,
          status: existing.status,
          shifts: [],
        })
      )
      return
    }

    if (method === 'PUT') {
      const payload = route.request().postDataJSON()
      timeOffRequests = timeOffRequests.map(request =>
        request.id === id
          ? {
              ...request,
              start_date: payload.start_date,
              end_date: payload.end_date,
              reason: payload.reason,
              notes: payload.notes,
            }
          : request
      )
      await route.fulfill(json({ id }))
      return
    }

    await route.fallback()
  })

  await page.route('**/api/time-off', async route => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }

    const payload = route.request().postDataJSON()
    const created = {
      id: `req-${timeOffRequests.length + 1}`,
      teacher_id: payload.teacher_id,
      teacher_name: 'Bella Wilbanks',
      start_date: '2099-01-10',
      end_date: '2099-01-10',
      status: 'active',
      coverage_status: 'needs_coverage',
      total: 1,
      covered: 0,
      partial: 0,
      uncovered: 1,
      shift_details: [{ label: 'Sat AM', status: 'uncovered' }],
      classrooms: [{ id: 'room-1', name: 'Infant Room', color: null }],
      reason: payload.reason ?? null,
      notes: payload.notes ?? null,
    }
    timeOffRequests = [created, ...timeOffRequests]
    await route.fulfill(json({ id: created.id }))
  })

  await ensureAuthenticated(page, '/time-off')

  await expect(page.getByRole('heading', { name: /time off requests/i })).toBeVisible()

  await page.getByRole('button', { name: /add time off/i }).click()
  await page.getByPlaceholder('Select a teacher').click()
  await page.getByRole('button', { name: /bella wilbanks/i }).click()
  await page.locator('#time-off-start-date').click()
  await page.getByRole('button', { name: /^10$/ }).first().click()
  await page.getByRole('button', { name: /^create$/i }).click()

  await expect(page.getByText(/time off added for/i)).toBeVisible()
  await expect(page.getByText('Bella Wilbanks').first()).toBeVisible()

  await page
    .getByRole('link', { name: /^edit$/i })
    .first()
    .click()
  await expect(page.getByRole('heading', { name: /edit time off request/i })).toBeVisible()
  await page.getByPlaceholder('Optional notes').fill('Updated from smoke test')
  await page.getByRole('button', { name: /^update$/i }).click()

  await expect(page.getByText(/time off updated for/i)).toBeVisible()
})
