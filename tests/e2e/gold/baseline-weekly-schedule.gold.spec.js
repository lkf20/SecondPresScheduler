/**
 * Gold scenario: Baseline → weekly schedule correctness.
 * See scenarios/gold/03-baseline-weekly-schedule-correctness.md
 * Weekly schedule loads and shows structure (classrooms, assignments).
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
            assignments: [
              {
                id: 'a1',
                teacher_id: 't1',
                teacher_name: 'Bella W.',
                classroom_id: 'c1',
                classroom_name: 'Infant Room',
              },
            ],
            absences: [],
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

test('weekly schedule loads and shows classroom and assignment @gold', async ({ page }) => {
  test.skip(!hasE2ECredentials(), 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run gold scenarios.')

  await page.route('**/api/weekly-schedule**', async route => {
    await route.fulfill(json(weeklyFixture))
  })
  await page.route('**/api/schedule-settings**', async route => {
    await route.fulfill(json({ selected_day_ids: ['d1'] }))
  })
  await page.route('**/api/days-of-week**', async route => {
    await route.fulfill(
      json([
        { id: 'd1', name: 'Monday', short_name: 'Mon', day_number: 1 },
        { id: 'd2', name: 'Tuesday', short_name: 'Tue', day_number: 2 },
      ])
    )
  })
  await page.route('**/api/timeslots**', async route => {
    await route.fulfill(
      json([
        {
          id: 's1',
          code: 'AM',
          name: 'Morning',
          display_order: 1,
          default_start_time: '08:00',
          default_end_time: '12:00',
        },
      ])
    )
  })

  await ensureAuthenticated(page, '/schedules/weekly')
  await expect(page.getByRole('heading', { name: /weekly schedule|schedule/i })).toBeVisible({
    timeout: 15000,
  })

  await expect(page.getByText('Infant Room')).toBeVisible({ timeout: 10000 })
  await expect(page.getByText('Bella W.')).toBeVisible({ timeout: 5000 })
})
