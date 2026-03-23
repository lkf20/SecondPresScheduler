import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import BaselineSchedulePage from '../page'

const searchParamValues = new Map<string, string>()

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => searchParamValues.get(key) ?? null,
  }),
}))

jest.mock('@/lib/contexts/SchoolContext', () => ({
  useSchool: () => 'school-1',
}))

jest.mock('@/lib/hooks/use-weekly-schedule', () => ({
  useWeeklySchedule: jest.fn(),
}))

jest.mock('@/lib/hooks/use-schedule-settings', () => ({
  useScheduleSettings: jest.fn(),
}))

jest.mock('@/lib/hooks/use-filter-options', () => ({
  useFilterOptions: jest.fn(),
}))

jest.mock('@/lib/schedules/schedule-filter-data', () => ({
  applyScheduleFilters: (data: unknown) => data,
}))

jest.mock('@/components/schedules/WeeklyScheduleGridNew', () => {
  return function WeeklyScheduleGridNewMock(props: {
    selectedDayIds: string[]
    initialSelectedCell?: { classroomId: string; dayId: string; timeSlotId: string } | null
  }) {
    return (
      <div>
        <div data-testid="grid-selected-day-ids">{(props.selectedDayIds || []).join(',')}</div>
        <div data-testid="grid-initial-selected-cell">
          {props.initialSelectedCell ? JSON.stringify(props.initialSelectedCell) : 'none'}
        </div>
      </div>
    )
  }
})

jest.mock('@/components/schedules/FilterPanel', () => {
  return function FilterPanelMock() {
    return null
  }
})

jest.mock('@/components/schedules/TeacherFilterSearch', () => {
  return function TeacherFilterSearchMock() {
    return null
  }
})

jest.mock('@/components/shared/LoadingSpinner', () => {
  return function LoadingSpinnerMock() {
    return <div>Loading...</div>
  }
})

const { useWeeklySchedule } = jest.requireMock('@/lib/hooks/use-weekly-schedule') as {
  useWeeklySchedule: jest.Mock
}
const { useScheduleSettings } = jest.requireMock('@/lib/hooks/use-schedule-settings') as {
  useScheduleSettings: jest.Mock
}
const { useFilterOptions } = jest.requireMock('@/lib/hooks/use-filter-options') as {
  useFilterOptions: jest.Mock
}

describe('BaselineSchedulePage day filtering', () => {
  beforeEach(() => {
    localStorage.clear()
    searchParamValues.clear()

    useScheduleSettings.mockReturnValue({
      data: {
        selected_day_ids: ['day-mon', 'day-tue', 'day-wed', 'day-thu', 'day-fri'],
      },
      isLoading: false,
    })

    useFilterOptions.mockReturnValue({
      data: {
        days: [
          { id: 'day-mon', name: 'Monday' },
          { id: 'day-tue', name: 'Tuesday' },
          { id: 'day-wed', name: 'Wednesday' },
          { id: 'day-thu', name: 'Thursday' },
          { id: 'day-fri', name: 'Friday' },
          { id: 'day-sat', name: 'Saturday' },
          { id: 'day-sun', name: 'Sunday' },
        ],
        timeSlots: [{ id: 'slot-1', code: 'AM' }],
        classrooms: [{ id: 'class-1', name: 'Infant Room' }],
      },
      isLoading: false,
    })

    useWeeklySchedule.mockReturnValue({
      data: {
        classrooms: [
          {
            classroom_id: 'class-1',
            classroom_name: 'Infant Room',
            classroom_color: '#fff',
            days: [
              {
                day_of_week_id: 'day-mon',
                day_name: 'Monday',
                day_number: 1,
                time_slots: [],
              },
              {
                day_of_week_id: 'day-sat',
                day_name: 'Saturday',
                day_number: 6,
                time_slots: [],
              },
              {
                day_of_week_id: 'day-sun',
                day_name: 'Sunday',
                day_number: 7,
                time_slots: [],
              },
            ],
          },
        ],
      },
      isLoading: false,
      error: null,
    })
  })

  it('removes stale weekend IDs from persisted baseline filters when settings allow only weekdays', async () => {
    localStorage.setItem(
      'baseline-schedule-filters',
      JSON.stringify({
        selectedDayIds: [
          'day-mon',
          'day-tue',
          'day-wed',
          'day-thu',
          'day-fri',
          'day-sat',
          'day-sun',
        ],
        selectedTimeSlotIds: ['slot-1'],
        selectedClassroomIds: ['class-1'],
        slotFilterMode: 'all',
        showInactiveClassrooms: false,
        showInactiveTimeSlots: false,
        displayFilters: {
          belowRequired: true,
          belowPreferred: true,
          fullyStaffed: true,
          inactive: true,
          viewNotes: false,
        },
        displayMode: 'permanent-only',
        layout: 'days-x-classrooms',
      })
    )

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <BaselineSchedulePage />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('grid-selected-day-ids')).toHaveTextContent(
        'day-mon,day-tue,day-wed,day-thu,day-fri'
      )
    })
    expect(screen.getByTestId('grid-selected-day-ids')).not.toHaveTextContent('day-sat')
    expect(screen.getByTestId('grid-selected-day-ids')).not.toHaveTextContent('day-sun')
  })

  it('passes initialSelectedCell when open_panel=true deep link params are present', async () => {
    searchParamValues.set('open_panel', 'true')
    searchParamValues.set('classroom_id', 'class-1')
    searchParamValues.set('day_of_week_id', 'day-mon')
    searchParamValues.set('time_slot_id', 'slot-1')

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <BaselineSchedulePage />
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('grid-initial-selected-cell')).toHaveTextContent(
        '{"classroomId":"class-1","dayId":"day-mon","timeSlotId":"slot-1"}'
      )
    })
  })
})
