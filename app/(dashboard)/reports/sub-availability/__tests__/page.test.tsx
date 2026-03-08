import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SubAvailabilityReportPage from '@/app/(dashboard)/reports/sub-availability/page'

const successToastMock = jest.fn()
const errorToastMock = jest.fn()

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => successToastMock(...args),
    error: (...args: unknown[]) => errorToastMock(...args),
  },
}))

describe('Sub Availability report page', () => {
  const openMock = jest.fn()
  let originalOpen: typeof window.open
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    originalOpen = window.open
    window.open = openMock as any
    global.fetch = jest.fn(
      async () =>
        ({
          ok: true,
          json: async () => ({
            generated_at: 'Mar 7, 2026, 4:35 PM',
            sub_count: 1,
            report_context: {
              columns: [
                {
                  dayId: 'day-mon',
                  dayName: 'Monday',
                  timeSlotId: 'slot-am',
                  timeSlotCode: 'AM',
                  timeSlotName: 'School Morning',
                },
              ],
              dayHeaders: [{ dayId: 'day-mon', dayName: 'Monday', colSpan: 1 }],
              rows: [
                {
                  id: 'sub-1',
                  subName: 'Test S.',
                  phone: '(502) 555-1212',
                  canTeach: ['Orange', "3's", "4's", 'Kindergarten'],
                  matrix: [{ key: 'day-mon|slot-am', available: true }],
                },
              ],
            },
          }),
        }) as Response
    ) as jest.Mock
  })

  afterEach(() => {
    window.open = originalOpen
    global.fetch = originalFetch
  })

  it('renders title and action buttons', async () => {
    render(<SubAvailabilityReportPage />)

    expect(screen.getByRole('heading', { name: 'Sub Availability' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Print PDF' })).toBeInTheDocument()
    expect(await screen.findByText('Test S.')).toBeInTheDocument()
  })

  it('opens the pdf url when Print PDF is clicked', async () => {
    openMock.mockReturnValue({} as Window)
    render(<SubAvailabilityReportPage />)
    await screen.findByText('Test S.')

    fireEvent.click(screen.getByRole('button', { name: 'Print PDF' }))

    expect(openMock).toHaveBeenCalledWith(
      '/api/reports/sub-availability/pdf?colorFriendly=true&nameFormat=display',
      '_blank',
      'noopener,noreferrer'
    )
    expect(successToastMock).toHaveBeenCalled()
  })

  it('shows popup error toast when window.open is blocked', async () => {
    openMock.mockReturnValue(null)
    render(<SubAvailabilityReportPage />)
    await screen.findByText('Test S.')

    fireEvent.click(screen.getByRole('button', { name: 'Print PDF' }))

    expect(errorToastMock).toHaveBeenCalled()
  })

  it('uses black and white mode in pdf url after toggle', async () => {
    openMock.mockReturnValue({} as Window)
    render(<SubAvailabilityReportPage />)
    await screen.findByText('Test S.')

    fireEvent.click(screen.getByRole('button', { name: 'Black & White' }))
    fireEvent.click(screen.getByRole('button', { name: 'Print PDF' }))

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        '/api/reports/sub-availability/pdf?colorFriendly=false&nameFormat=display',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  it('uses full name mode in pdf url after toggle', async () => {
    openMock.mockReturnValue({} as Window)
    render(<SubAvailabilityReportPage />)
    await screen.findByText('Test S.')

    fireEvent.click(screen.getByRole('button', { name: 'Full Name' }))
    fireEvent.click(screen.getByRole('button', { name: 'Print PDF' }))

    await waitFor(() => {
      expect(openMock).toHaveBeenCalledWith(
        '/api/reports/sub-availability/pdf?colorFriendly=true&nameFormat=full',
        '_blank',
        'noopener,noreferrer'
      )
    })
  })

  it('renders duplicate names safely when ids are unique', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        generated_at: 'Mar 7, 2026, 4:35 PM',
        sub_count: 2,
        report_context: {
          columns: [],
          dayHeaders: [],
          rows: [
            {
              id: 'sub-1',
              subName: 'Alex P.',
              phone: '(502) 555-1111',
              canTeach: ['All'],
              matrix: [],
            },
            {
              id: 'sub-2',
              subName: 'Alex P.',
              phone: '(502) 555-2222',
              canTeach: ['All'],
              matrix: [],
            },
          ],
        },
      }),
    })

    render(<SubAvailabilityReportPage />)
    expect(await screen.findAllByText('Alex P.')).toHaveLength(2)
  })

  it('shows empty matrix guidance when no schedule days are selected', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        generated_at: 'Mar 7, 2026, 4:35 PM',
        sub_count: 1,
        report_context: {
          columns: [],
          dayHeaders: [],
          rows: [
            {
              id: 'sub-1',
              subName: 'Test S.',
              phone: '(502) 555-1212',
              canTeach: ['All'],
              matrix: [],
            },
          ],
        },
      }),
    })

    render(<SubAvailabilityReportPage />)
    expect(
      await screen.findByText(
        'No schedule days are selected in settings. Availability matrix is empty.'
      )
    ).toBeInTheDocument()
  })
})
