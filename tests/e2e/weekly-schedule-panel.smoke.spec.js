const { test, expect } = require('@playwright/test')
const { ensureAuthenticated, hasE2ECredentials } = require('./helpers/auth')

const json = payload => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(payload),
})

const weeklyScheduleFixture = [
  {
    classroom_id: 'class-1',
    classroom_name: 'Infant Room',
    classroom_color: '#8ec5ff',
    days: [
      {
        day_of_week_id: 'day-mon',
        day_name: 'Monday',
        day_number: 1,
        time_slots: [
          {
            time_slot_id: 'slot-em',
            time_slot_code: 'EM',
            time_slot_name: 'Early Morning',
            time_slot_display_order: 1,
            time_slot_start_time: '08:00',
            time_slot_end_time: '10:00',
            assignments: [
              {
                id: 'assign-teacher-1',
                teacher_id: 'teacher-1',
                teacher_name: 'Bella W.',
                classroom_id: 'class-1',
                classroom_name: 'Infant Room',
              },
              {
                id: 'assign-flex-1',
                teacher_id: 'teacher-2',
                teacher_name: 'Amy P.',
                classroom_id: 'class-1',
                classroom_name: 'Infant Room',
                is_flexible: true,
                staffing_event_id: 'event-1',
              },
            ],
            absences: [],
            schedule_cell: {
              id: 'cell-1',
              is_active: true,
              enrollment_for_staffing: 8,
              notes: null,
              class_groups: [
                {
                  id: 'cg-1',
                  name: 'Infant A',
                  min_age: 1,
                  max_age: 2,
                  required_ratio: 4,
                  preferred_ratio: 3,
                },
              ],
            },
          },
        ],
      },
    ],
  },
]

async function mockWeeklyScheduleApis(page) {
  let removePostCalled = false
  let weeklyScheduleRequestCount = 0

  await page.route('**/api/weekly-schedule**', async route => {
    weeklyScheduleRequestCount += 1
    await route.fulfill(json(weeklyScheduleFixture))
  })

  await page.route('**/api/schedule-settings**', async route => {
    await route.fulfill(json({ selected_day_ids: ['day-mon'] }))
  })

  await page.route('**/api/days-of-week**', async route => {
    await route.fulfill(
      json([
        { id: 'day-mon', name: 'Monday', short_name: 'Mon', day_number: 1 },
        { id: 'day-tue', name: 'Tuesday', short_name: 'Tue', day_number: 2 },
      ])
    )
  })

  await page.route('**/api/timeslots**', async route => {
    await route.fulfill(
      json([
        {
          id: 'slot-em',
          code: 'EM',
          name: 'Early Morning',
          display_order: 1,
          default_start_time: '08:00',
          default_end_time: '10:00',
        },
      ])
    )
  })

  await page.route('**/api/classrooms**', async route => {
    await route.fulfill(
      json([
        {
          id: 'class-1',
          name: 'Infant Room',
          color: '#8ec5ff',
          active: true,
          allowed_classes: [],
        },
      ])
    )
  })

  await page.route('**/api/class-groups?includeInactive=true**', async route => {
    await route.fulfill(
      json([
        {
          id: 'cg-1',
          name: 'Infant A',
          min_age: 1,
          max_age: 2,
          required_ratio: 4,
          preferred_ratio: 3,
          active: true,
        },
      ])
    )
  })

  await page.route('**/api/teacher-schedules**', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill(json({ id: `ts-${Date.now()}` }))
      return
    }
    await route.fulfill(json([]))
  })

  await page.route('**/api/teacher-schedules/*', async route => {
    const method = route.request().method()
    if (method === 'DELETE') {
      await route.fulfill({ status: 204, body: '' })
      return
    }
    if (method === 'PUT') {
      await route.fulfill(json({ id: 'updated-teacher-schedule', is_floater: false }))
      return
    }
    await route.fallback()
  })

  await page.route('**/api/schedule-cells/bulk', async route => {
    if (route.request().method() !== 'PUT') {
      await route.fallback()
      return
    }
    await route.fulfill(json({ success: true }))
  })

  await page.route('**/api/display-preferences**', async route => {
    await route.fulfill(json({ format: 'first_last_initial' }))
  })

  await page.route('**/api/staffing-events/flex/remove?**', async route => {
    await route.fulfill(
      json({
        start_date: '2026-01-01',
        end_date: '2026-03-01',
        weekdays: ['Monday', 'Wednesday', 'Friday'],
        matching_shift_count: 6,
      })
    )
  })

  await page.route('**/api/staffing-events/flex/remove', async route => {
    if (route.request().method() !== 'POST') {
      await route.fallback()
      return
    }
    removePostCalled = true
    await route.fulfill(json({ success: true }))
  })

  return {
    wasRemovePosted: () => removePostCalled,
    weeklyScheduleRequestCount: () => weeklyScheduleRequestCount,
  }
}

test('weekly schedule baseline handoff and return @smoke', async ({ page }) => {
  test.skip(
    !hasE2ECredentials(),
    'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run protected smoke flows.'
  )

  await mockWeeklyScheduleApis(page)
  await ensureAuthenticated(page, '/schedules/weekly')

  await expect(page.getByRole('heading', { name: /weekly schedule/i })).toBeVisible()
  await page.getByText('Bella W.').first().click()
  await expect(page.getByText('Edit permanent staff')).toBeVisible()

  await page.getByText('Edit permanent staff').click()
  await expect(page.getByText('Edit baseline assignment?')).toBeVisible()
  await page.getByRole('button', { name: /^continue$/i }).click()

  await expect(page.getByText('Edit Permanent Staff')).toBeVisible()
  await page.getByRole('button', { name: /^back$/i }).click()
  await expect(page.getByText('Flex Staff')).toBeVisible()
})

test('weekly schedule flex removal scope flow @smoke', async ({ page }) => {
  test.skip(
    !hasE2ECredentials(),
    'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run protected smoke flows.'
  )

  const tracker = await mockWeeklyScheduleApis(page)
  await ensureAuthenticated(page, '/schedules/weekly')

  await page.getByText('Bella W.').first().click()
  await page.getByRole('button', { name: /^remove$/i }).click()

  await expect(page.getByText('Remove flex assignment?')).toBeVisible()
  await expect(page.getByText(/Amy P\. is assigned as flex staff to Infant Room/i)).toBeVisible()
  await expect(page.getByText('This shift only')).toBeVisible()
  await expect(page.getByText('All Monday shifts')).toBeVisible()
  await expect(page.getByText('All shifts')).toBeVisible()

  await page.getByLabel('All shifts').check()
  await page
    .getByRole('button', { name: /^remove$/i })
    .last()
    .click()

  await expect.poll(() => tracker.wasRemovePosted()).toBe(true)
  await expect(page.getByText(/removed from all shifts/i)).toBeVisible()
})

test('weekly schedule baseline save refreshes schedule data @smoke', async ({ page }) => {
  test.skip(
    !hasE2ECredentials(),
    'Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run protected smoke flows.'
  )

  const tracker = await mockWeeklyScheduleApis(page)
  await ensureAuthenticated(page, '/schedules/weekly')

  await page.getByText('Bella W.').first().click()
  await page.getByText('Edit permanent staff').click()
  await page.getByRole('button', { name: /^continue$/i }).click()

  await page
    .getByRole('button', { name: /^save$/i })
    .last()
    .click()

  await expect(page.getByText(/baseline schedule saved/i)).toBeVisible()
  await expect.poll(() => tracker.weeklyScheduleRequestCount()).toBeGreaterThan(1)
})
