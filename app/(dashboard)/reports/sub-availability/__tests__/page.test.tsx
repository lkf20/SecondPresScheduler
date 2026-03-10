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
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/reports/sub-availability/defaults')) {
        return {
          ok: true,
          json: async () => ({
            top_header_html: '',
            footer_notes_html: '',
          }),
        } as Response
      }

      return {
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
      } as Response
    }) as jest.Mock
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

  it('saves header/footer defaults', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/api/reports/sub-availability/defaults') && init?.method === 'PUT') {
          return {
            ok: true,
            json: async () => ({
              top_header_html: '<div>Header</div>',
              footer_notes_html: '<div>Footer</div>',
            }),
          } as Response
        }
        if (url.includes('/api/reports/sub-availability/defaults')) {
          return {
            ok: true,
            json: async () => ({
              top_header_html: '<div>Header</div>',
              footer_notes_html: '<div>Footer</div>',
            }),
          } as Response
        }
        return {
          ok: true,
          json: async () => ({
            generated_at: 'Mar 7, 2026, 4:35 PM',
            sub_count: 1,
            report_context: { columns: [], dayHeaders: [], rows: [] },
          }),
        } as Response
      }
    )

    render(<SubAvailabilityReportPage />)
    await screen.findByText('Header')
    await screen.findByText('Save as default header')
    fireEvent.click(screen.getByRole('button', { name: 'Save as default header' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })

    const defaultsPutCall = (global.fetch as jest.Mock).mock.calls.find(
      call =>
        String(call[0]).includes('/api/reports/sub-availability/defaults') &&
        call[1]?.method === 'PUT'
    )
    expect(defaultsPutCall).toBeTruthy()
    const payload = JSON.parse(defaultsPutCall?.[1]?.body as string)
    expect(payload).toEqual({
      top_header_html: '<div>Header</div>',
    })
    expect(successToastMock).toHaveBeenCalled()
  })

  it('saves footer defaults independently', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.includes('/api/reports/sub-availability/defaults') && init?.method === 'PUT') {
          return {
            ok: true,
            json: async () => ({
              footer_notes_html: '<div>Footer</div>',
            }),
          } as Response
        }
        if (url.includes('/api/reports/sub-availability/defaults')) {
          return {
            ok: true,
            json: async () => ({
              top_header_html: '',
              footer_notes_html: '<div>Footer</div>',
            }),
          } as Response
        }
        return {
          ok: true,
          json: async () => ({
            generated_at: 'Mar 7, 2026, 4:35 PM',
            sub_count: 1,
            report_context: { columns: [], dayHeaders: [], rows: [] },
          }),
        } as Response
      }
    )

    render(<SubAvailabilityReportPage />)
    await screen.findByText('Footer')
    await screen.findByText('Save as default footer')
    fireEvent.click(screen.getByRole('button', { name: 'Save as default footer' }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
    const defaultsPutCall = (global.fetch as jest.Mock).mock.calls.find(
      call =>
        String(call[0]).includes('/api/reports/sub-availability/defaults') &&
        call[1]?.method === 'PUT'
    )
    expect(defaultsPutCall).toBeTruthy()
    const payload = JSON.parse(defaultsPutCall?.[1]?.body as string)
    expect(payload).toEqual({
      footer_notes_html: '<div>Footer</div>',
    })
    expect(successToastMock).toHaveBeenCalled()
  })

  it('loads saved header/footer defaults into editors and preview and passes them to PDF url', async () => {
    openMock.mockReturnValue({} as Window)
    ;(global.fetch as jest.Mock).mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/reports/sub-availability/defaults')) {
        return {
          ok: true,
          json: async () => ({
            top_header_html: '<div>Center Header</div>',
            footer_notes_html: '<div>Footer Note</div>',
          }),
        } as Response
      }
      return {
        ok: true,
        json: async () => ({
          generated_at: 'Mar 7, 2026, 4:35 PM',
          sub_count: 1,
          report_context: {
            columns: [],
            dayHeaders: [],
            rows: [],
          },
        }),
      } as Response
    })

    const { container } = render(<SubAvailabilityReportPage />)
    await screen.findByText('Center Header')
    expect(await screen.findAllByText('Footer Note')).toHaveLength(2)

    const editors = Array.from(container.querySelectorAll('div[contenteditable="true"]'))
    expect(editors).toHaveLength(2)
    expect(editors[0]?.innerHTML).toContain('Center Header')
    expect(editors[1]?.innerHTML).toContain('Footer Note')

    fireEvent.click(screen.getByRole('button', { name: 'Print PDF' }))

    await waitFor(() => {
      expect(openMock).toHaveBeenCalled()
    })
    const openedUrl = String((openMock as jest.Mock).mock.calls.at(-1)?.[0] || '')
    expect(openedUrl).toContain('topHeaderHtml=')
    expect(openedUrl).toContain('footerNotesHtml=')
    const decodedUrl = decodeURIComponent(openedUrl).replace(/\+/g, ' ')
    expect(decodedUrl).toContain('<div>Center Header</div>')
    expect(decodedUrl).toContain('<div>Footer Note</div>')
  })
})
