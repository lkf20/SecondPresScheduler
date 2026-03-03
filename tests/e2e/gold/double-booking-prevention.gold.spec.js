/**
 * Gold scenario: Double-booking prevention.
 * See scenarios/gold/01-double-booking-prevention.md
 * API returns 409 when sub already assigned to same shift(s); UI must show the error.
 */
const { test, expect } = require('@playwright/test')
const { ensureAuthenticated, hasE2ECredentials } = require('../helpers/auth')

const json = payload => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(payload),
})

test('assign-shifts 409 double-booking error is shown in UI @gold', async ({ page }) => {
  test.skip(!hasE2ECredentials(), 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run gold scenarios.')

  const doubleBookMessage =
    'Double booking prevented: this sub already has an active assignment for one or more selected shifts.'
  let assignShiftsCallCount = 0
  const absenceId = 'abs-1'
  const shiftDate = '2099-01-12'
  const shiftCode = 'EM'
  const shiftKey = `${shiftDate}|${shiftCode}`

  await page.route('**/api/teachers', async route => {
    await route.fulfill(
      json([
        {
          id: 'teacher-1',
          first_name: 'Amy',
          last_name: 'Parker',
          display_name: 'Amy P.',
          active: true,
        },
      ])
    )
  })
  await page.route('**/api/subs/sub-1', async route => {
    await route.fulfill(json({ id: 'sub-1', active: true }))
  })
  await page.route('**/api/sub-finder/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const pathname = url.pathname

    if (method === 'GET' && pathname === '/api/sub-finder/absences') {
      await route.fulfill(
        json([
          {
            id: absenceId,
            teacher_id: 'teacher-1',
            teacher_name: 'Amy P.',
            start_date: shiftDate,
            end_date: shiftDate,
            reason: 'Sick',
            status: 'needs_coverage',
            shifts: {
              total: 1,
              uncovered: 1,
              covered: 0,
              partial: 0,
              shift_details: [
                {
                  id: 'shift-1',
                  date: shiftDate,
                  day_name: 'Monday',
                  time_slot_code: shiftCode,
                  classroom_name: 'Infant Room',
                  status: 'uncovered',
                  assignment_status: 'none',
                },
              ],
            },
          },
        ])
      )
      return
    }
    if (method === 'GET' && pathname === `/api/sub-finder/coverage-request/${absenceId}`) {
      await route.fulfill(
        json({
          coverage_request_id: 'cr-1',
          shift_map: { [shiftKey]: 'shift-1' },
        })
      )
      return
    }
    if (
      method === 'GET' &&
      pathname === '/api/sub-finder/substitute-contacts' &&
      url.search.includes('coverage_request_id=cr-1')
    ) {
      await route.fulfill(
        json({
          id: 'contact-1',
          is_contacted: false,
          response_status: 'none',
          coverage_request_id: 'cr-1',
          selected_shift_keys: [shiftKey],
          override_shift_keys: [],
        })
      )
      return
    }
    if (
      method === 'GET' &&
      pathname === `/api/sub-finder/coverage-request/${absenceId}/assigned-shifts`
    ) {
      await route.fulfill(json({ remaining_shift_keys: [shiftKey], remaining_shift_count: 1 }))
      return
    }
    if (method === 'POST' && pathname === '/api/sub-finder/find-subs') {
      await route.fulfill(
        json({
          subs: [
            {
              id: 'sub-1',
              name: 'Sally A.',
              phone: null,
              email: null,
              coverage_percent: 100,
              shifts_covered: 1,
              total_shifts: 1,
              can_cover: [
                {
                  date: shiftDate,
                  day_name: 'Monday',
                  time_slot_code: shiftCode,
                  class_name: null,
                  classroom_name: 'Infant Room',
                },
              ],
              cannot_cover: [],
              assigned_shifts: [],
              remaining_shift_keys: [shiftKey],
              remaining_shift_count: 1,
              has_assigned_shifts: false,
              response_status: 'none',
              is_contacted: false,
            },
          ],
          recommended_combinations: [],
        })
      )
      return
    }
    if (method === 'POST' && pathname === '/api/sub-finder/shift-overrides') {
      await route.fulfill(
        json({
          shift_overrides: [
            {
              coverage_request_shift_id: 'shift-1',
              selected: true,
              override_availability: false,
            },
          ],
          selected_shift_ids: ['shift-1'],
        })
      )
      return
    }
    if (method === 'PUT' && pathname === '/api/sub-finder/substitute-contacts') {
      await route.fulfill(
        json({
          id: 'contact-1',
          is_contacted: true,
          response_status: 'confirmed',
        })
      )
      return
    }
    if (method === 'POST' && pathname === '/api/sub-finder/assign-shifts') {
      assignShiftsCallCount += 1
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: doubleBookMessage }),
      })
      return
    }
    await route.fallback()
  })

  await ensureAuthenticated(page, '/sub-finder')
  await expect(page.getByRole('heading', { name: /sub finder/i })).toBeVisible()

  const [findSubsResponse] = await Promise.all([
    page.waitForResponse(
      res => res.url().includes('/api/sub-finder/find-subs') && res.request().method() === 'POST',
      { timeout: 15000 }
    ),
    page
      .getByRole('button', { name: /find subs/i })
      .first()
      .click(),
  ])
  expect(findSubsResponse.ok()).toBe(true)

  // Sally A. may appear in multiple places (some hidden); ensure the sub card's Contact & Assign is visible
  await expect(page.getByRole('button', { name: /contact & assign/i }).first()).toBeVisible({
    timeout: 10000,
  })

  await page
    .getByRole('button', { name: /contact & assign/i })
    .first()
    .click()
  // Wait for Contact Sub panel (sheet) to open; select shift checkbox to enable Assign
  const shiftCheckbox = page.getByRole('checkbox').first()
  await expect(shiftCheckbox).toBeVisible({ timeout: 10000 })
  await shiftCheckbox.check()
  // Click Assign, then confirm in dialog
  await page.getByRole('button', { name: /^assign$/i }).click()
  await expect(page.getByRole('button', { name: /assign without confirming/i })).toBeVisible({
    timeout: 5000,
  })
  await page.getByRole('button', { name: /assign without confirming/i }).click()

  await expect(page.getByText(/double booking prevented/i)).toBeVisible({ timeout: 10000 })
  expect(assignShiftsCallCount).toBe(1)
})
