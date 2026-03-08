/**
 * Gold scenario: Strict View Mode Filtering (Scenario 3B)
 * See scenarios/gold/06-ai-simulation-prompts.md
 * Display mode 'Substitutes Only'. Cell contains 1 Perm, 1 Absence, NO Sub.
 * Cell should not show the Permanent Teacher or the Absence.
 */
const { test, expect } = require('@playwright/test')
const { ensureAuthenticated, hasE2ECredentials } = require('../helpers/auth')

const json = payload => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(payload),
})

const weeklyFixture = [
  {
    classroom_id: 'c1',
    classroom_name: 'Infant Room',
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
                classroom_name: 'Infant Room',
                is_substitute: false,
              },
            ],
            absences: [
              {
                teacher_id: 't2',
                teacher_name: 'Absent Teacher',
                has_sub: false,
                is_partial: false,
              },
            ],
            schedule_cell: {
              id: 'cell-1',
              is_active: true,
              enrollment_for_staffing: 8,
              class_groups: [
                { id: 'cg1', name: 'Infant A', required_ratio: 4, preferred_ratio: 3 },
              ],
            },
          },
        ],
      },
    ],
  },
]

test('Ghost cell filtering in Substitutes Only mode @gold', async ({ page }) => {
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
      json([{ id: 'c1', name: 'Infant Room', color: '#8ec5ff', is_active: true }])
    )
  })

  await ensureAuthenticated(page, '/schedules/weekly')
  await expect(page.getByRole('heading', { name: 'Weekly Schedule' })).toBeVisible({
    timeout: 15000,
  })

  // Verify that Perm Teacher and Absent Teacher are initially visible
  await expect(page.getByText('Perm Teacher')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Absent Teacher')).toBeVisible({ timeout: 10000 })

  // Switch to Substitutes Only mode by clicking the chip that contains 'Subs'
  await page.getByRole('button', { name: /Subs/i }).click()

  // Verify that Perm Teacher and Absent Teacher are NOT visible
  await expect(page.getByText('Perm Teacher')).not.toBeVisible()
  await expect(page.getByText('Absent Teacher')).not.toBeVisible()
})
