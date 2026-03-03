/**
 * Gold scenario: Dynamic Absence Warning Colors (Scenario 2A & 2B)
 * See scenarios/gold/06-ai-simulation-prompts.md
 *
 * Verifies that the absence warning icon changes color based on the overall cell's staffing status:
 * - Red if the cell is below required staffing
 * - Gray if the cell meets preferred staffing (e.g. covered by Flex)
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
    classroom_name: 'Room A', // Will be below required
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
            assignments: [], // 0 teachers present
            absences: [
              {
                teacher_id: 't1',
                teacher_name: 'Absent Bob',
                has_sub: false,
                is_partial: false,
              },
            ],
            schedule_cell: {
              id: 'cell-1',
              is_active: true,
              enrollment_for_staffing: 4,
              class_groups: [
                {
                  id: 'cg1',
                  name: 'Group 1',
                  age_unit: 'years',
                  min_age: 3,
                  max_age: 4,
                  required_ratio: 4,
                  preferred_ratio: 4,
                }, // Required 1
              ],
            },
          },
        ],
      },
    ],
  },
  {
    classroom_id: 'c2',
    classroom_name: 'Room B', // Will meet preferred (covered by flex)
    classroom_color: '#ff8ecc',
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
                teacher_id: 'f1',
                teacher_name: 'Flex Sally',
                classroom_id: 'c2',
                is_substitute: false,
                is_flexible: true,
                is_floater: false,
              },
            ], // 1 teacher present (Flex)
            absences: [
              {
                teacher_id: 't2',
                teacher_name: 'Absent Alice',
                has_sub: false,
                is_partial: false,
              },
            ],
            schedule_cell: {
              id: 'cell-2',
              is_active: true,
              enrollment_for_staffing: 4,
              class_groups: [
                {
                  id: 'cg2',
                  name: 'Group 2',
                  age_unit: 'years',
                  min_age: 3,
                  max_age: 4,
                  required_ratio: 4,
                  preferred_ratio: 4,
                }, // Required 1
              ],
            },
          },
        ],
      },
    ],
  },
]

test('Absence warning icon scales color based on cell staffing status @gold', async ({ page }) => {
  test.skip(!hasE2ECredentials(), 'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run gold scenarios.')

  await page.route('**/api/weekly-schedule**', async route => {
    await route.fulfill(json(weeklyFixture))
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
      json([
        { id: 'c1', name: 'Room A', color: '#8ec5ff', is_active: true },
        { id: 'c2', name: 'Room B', color: '#ff8ecc', is_active: true },
      ])
    )
  })

  await ensureAuthenticated(page, '/schedules/weekly')
  await expect(page.getByRole('heading', { name: 'Weekly Schedule' })).toBeVisible({
    timeout: 15000,
  })

  // Validate Room A (Red warning)
  const roomA = page
    .locator('div')
    .filter({ hasText: /^Room A$/ })
    .first()
  await expect(roomA).toBeVisible()

  // Find the absent chip for Bob and check its warning icon
  const bobChip = page.getByText('Absent Bob').locator('..') // Get parent span
  const redWarningIcon = bobChip.locator('svg.text-red-600')
  await expect(redWarningIcon).toBeVisible()

  // Validate Room B (Gray warning because it is covered by Flex Sally)
  const roomB = page
    .locator('div')
    .filter({ hasText: /^Room B$/ })
    .first()
  await expect(roomB).toBeVisible()

  const aliceChip = page.getByText('Absent Alice').locator('..')
  const grayWarningIcon = aliceChip.locator('svg.text-gray-400')
  await expect(grayWarningIcon).toBeVisible()
})
