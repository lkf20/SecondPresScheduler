const { test, expect } = require('@playwright/test')
const { ensureAuthenticated, hasE2ECredentials } = require('./helpers/auth')

const json = payload => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(payload),
})

test('sub finder find and assign flow @smoke', async ({ page }) => {
  test.skip(
    !hasE2ECredentials(),
    'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run protected smoke flows.'
  )

  const absenceId = 'absence-1'
  const coverageRequestId = 'coverage-1'
  const shiftDate = '2099-01-12'
  const shiftCode = 'EM'
  const shiftKey = `${shiftDate}|${shiftCode}`
  let isAssigned = false

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
    const { pathname, search } = url

    if (method === 'GET' && pathname === '/api/sub-finder/absences') {
      await route.fulfill(
        json([
          {
            id: absenceId,
            teacher_id: 'teacher-1',
            teacher_name: 'Amy P.',
            start_date: shiftDate,
            end_date: shiftDate,
            reason: 'Sick Day',
            notes: null,
            status: isAssigned ? 'covered' : 'needs_coverage',
            shifts: {
              total: 1,
              uncovered: isAssigned ? 0 : 1,
              covered: isAssigned ? 1 : 0,
              partial: 0,
              shift_details: [
                {
                  id: 'coverage-shift-1',
                  date: shiftDate,
                  day_name: 'Monday',
                  time_slot_code: shiftCode,
                  class_name: 'Infant A',
                  classroom_name: 'Infant Room',
                  classroom_color: null,
                  status: isAssigned ? 'covered' : 'uncovered',
                  sub_name: isAssigned ? 'Sally A.' : null,
                  assignment_status: isAssigned ? 'confirmed' : 'none',
                },
              ],
            },
            classrooms: [{ id: 'room-1', name: 'Infant Room', color: null }],
          },
        ])
      )
      return
    }

    if (method === 'POST' && pathname === '/api/sub-finder/find-subs') {
      await route.fulfill(
        json({
          subs: [
            {
              id: 'sub-1',
              name: 'Sally A.',
              phone: '555-000-1111',
              email: 'sally@example.com',
              coverage_percent: 100,
              shifts_covered: 1,
              total_shifts: 1,
              can_cover: [
                {
                  date: shiftDate,
                  day_name: 'Monday',
                  time_slot_code: shiftCode,
                  class_name: 'Infant A',
                  classroom_name: 'Infant Room',
                },
              ],
              cannot_cover: [],
              assigned_shifts: isAssigned
                ? [
                    {
                      date: shiftDate,
                      day_name: 'Monday',
                      time_slot_code: shiftCode,
                      classroom_name: 'Infant Room',
                    },
                  ]
                : [],
              remaining_shift_keys: isAssigned ? [] : [shiftKey],
              remaining_shift_count: isAssigned ? 0 : 1,
              has_assigned_shifts: isAssigned,
              response_status: isAssigned ? 'confirmed' : 'none',
              is_contacted: isAssigned,
            },
          ],
          recommended_combinations: [],
        })
      )
      return
    }

    if (method === 'GET' && pathname === `/api/sub-finder/coverage-request/${absenceId}`) {
      await route.fulfill(
        json({
          coverage_request_id: coverageRequestId,
          shift_map: { [shiftKey]: 'coverage-shift-1' },
        })
      )
      return
    }

    if (
      method === 'GET' &&
      pathname === '/api/sub-finder/substitute-contacts' &&
      search.includes(`coverage_request_id=${coverageRequestId}`) &&
      search.includes('sub_id=sub-1')
    ) {
      await route.fulfill(
        json({
          id: 'contact-1',
          is_contacted: isAssigned,
          contacted_at: null,
          response_status: isAssigned ? 'confirmed' : 'none',
          notes: null,
          coverage_request_id: coverageRequestId,
          selected_shift_keys: isAssigned ? [] : [shiftKey],
          override_shift_keys: [],
        })
      )
      return
    }

    if (
      method === 'GET' &&
      pathname === `/api/sub-finder/coverage-request/${absenceId}/assigned-shifts`
    ) {
      await route.fulfill(
        json({
          remaining_shift_keys: isAssigned ? [] : [shiftKey],
          remaining_shift_count: isAssigned ? 0 : 1,
        })
      )
      return
    }

    if (method === 'POST' && pathname === '/api/sub-finder/shift-overrides') {
      await route.fulfill(
        json({
          shift_overrides: [
            {
              coverage_request_shift_id: 'coverage-shift-1',
              selected: true,
              override_availability: false,
            },
          ],
          selected_shift_ids: ['coverage-shift-1'],
        })
      )
      return
    }

    if (method === 'PUT' && pathname === '/api/sub-finder/substitute-contacts') {
      await route.fulfill(
        json({
          id: 'contact-1',
          is_contacted: true,
          contacted_at: new Date().toISOString(),
          response_status: 'confirmed',
          notes: null,
        })
      )
      return
    }

    if (method === 'POST' && pathname === '/api/sub-finder/assign-shifts') {
      isAssigned = true
      await route.fulfill(
        json({
          sub_name: 'Sally A.',
          assigned_shifts: [
            {
              coverage_request_shift_id: 'coverage-shift-1',
              date: shiftDate,
              day_name: 'Monday',
              time_slot_code: shiftCode,
            },
          ],
        })
      )
      return
    }

    await route.fallback()
  })

  await ensureAuthenticated(page, '/sub-finder')
  await expect(page.getByRole('heading', { name: /sub finder/i })).toBeVisible()

  await page
    .getByRole('button', { name: /find subs/i })
    .first()
    .click()
  await expect(page.getByText('Sally A.').first()).toBeVisible()

  await page
    .getByRole('button', { name: /contact & assign/i })
    .first()
    .click()
  await expect(page.getByText(/contact sub/i).first()).toBeVisible()
  await page.getByRole('button', { name: /^assign$/i }).click()

  await expect(page.getByText(/assigned sally a\./i)).toBeVisible()
})
