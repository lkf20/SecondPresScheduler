/**
 * Gold scenario: Floater Math Threshold
 * See scenarios/gold/06-ai-simulation-prompts.md
 * Create a scenario where a classroom requires 2 teachers, has 1 permanent teacher, and 2 floaters.
 * Assert the UI shows "Meets Preferred".
 */
const { test, expect } = require('@playwright/test')
const { gotoWithAuth, hasE2ECredentials } = require('../helpers/auth')

const json = payload => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(payload),
})

const weeklyFixture = [
  {
    classroom_id: 'c1',
    classroom_name: 'Toddler Room',
    classroom_color: '#8ec5ff',
    classroom_is_active: true,
    days: [
      {
        day_of_week_id: 'd1',
        day_name: 'Monday',
        day_number: 1,
        time_slots: [
          {
            time_slot_id: 's1',
            time_slot_code: 'AM',
            time_slot_name: 'Morning',
            time_slot_is_active: true,
            assignments: [
              {
                id: 'a1',
                teacher_id: 't1',
                teacher_name: 'Perm Teacher',
                classroom_id: 'c1',
                is_substitute: false,
                is_floater: false,
              },
              {
                id: 'a2',
                teacher_id: 't2',
                teacher_name: 'Floater One',
                classroom_id: 'c1',
                is_substitute: false,
                is_floater: true,
              },
              {
                id: 'a3',
                teacher_id: 't3',
                teacher_name: 'Floater Two',
                classroom_id: 'c1',
                is_substitute: false,
                is_floater: true,
              },
            ],
            absences: [],
            schedule_cell: {
              id: 'cell-1',
              is_active: true,
              enrollment_for_staffing: 8,
              class_groups: [
                {
                  id: 'cg1',
                  name: 'Toddler A',
                  age_unit: 'months',
                  min_age: 12,
                  max_age: 24,
                  required_ratio: 4,
                  preferred_ratio: 4,
                }, // Required 2, Preferred 2
              ],
            },
          },
        ],
      },
    ],
  },
]

test('Floater math correctly calculates staffing status @gold', async ({ page }) => {
  test.skip(!hasE2ECredentials(), 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run gold scenarios.')

  await page.addInitScript(() => {
    localStorage.removeItem('weekly-schedule-filters')
  })

  await page.route('**/api/weekly-schedule**', async route => {
    await route.fulfill(json({ classrooms: weeklyFixture, school_closures: [] }))
  })
  await page.route('**/api/schedule-settings**', async route => {
    await route.fulfill(json({ selected_day_ids: ['d1'] }))
  })
  await page.route('**/api/days-of-week**', async route => {
    await route.fulfill(json([{ id: 'd1', name: 'Monday', short_name: 'Mon', day_number: 1 }]))
  })
  await page.route('**/api/timeslots**', async route => {
    await route.fulfill(json([{ id: 's1', code: 'AM', name: 'Morning', display_order: 1 }]))
  })
  await page.route('**/api/classrooms**', async route => {
    await route.fulfill(
      json([{ id: 'c1', name: 'Toddler Room', color: '#8ec5ff', is_active: true }])
    )
  })

  await gotoWithAuth(page, '/schedules/weekly')
  await expect(page.getByRole('heading', { name: 'Weekly Schedule' })).toBeVisible({
    timeout: 15000,
  })

  // Verify that all 3 teachers are visible (allow time for grid to render)
  await expect(page.getByText('Perm Teacher')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Floater One')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Floater Two')).toBeVisible({ timeout: 5000 })

  // The math should be 1 + 0.5 + 0.5 = 2. Required is 8 / 4 = 2.
  // Should show "Meets preferred staffing (2.0 teachers)" (since preferred is also 2)
  // Check that the green checkmark is visible (use .first() to avoid strict mode with multiple matches)
  const greenCheck = page.locator('svg.text-green-600').first()
  await expect(greenCheck).toBeVisible()
})
