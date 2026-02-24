import { fireEvent, render, screen } from '@testing-library/react'
import WeekendToggle from '@/components/settings/WeekendToggle'

jest.mock('@/components/ui/switch', () => ({
  Switch: ({
    id,
    checked,
    onCheckedChange,
  }: {
    id?: string
    checked?: boolean
    onCheckedChange?: (checked: boolean) => void
  }) => (
    <input
      id={id}
      type="checkbox"
      aria-label="Include weekends"
      checked={checked}
      onChange={e => onCheckedChange?.(e.target.checked)}
    />
  ),
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
}))

describe('WeekendToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  it('hydrates includeWeekends from localStorage on mount', () => {
    const onToggle = jest.fn()
    localStorage.setItem('schedule_include_weekends', 'true')

    render(<WeekendToggle includeWeekends={false} onToggle={onToggle} />)

    expect(onToggle).toHaveBeenCalledWith(true)
  })

  it('toggles value and persists preference to localStorage', () => {
    const onToggle = jest.fn()

    render(<WeekendToggle includeWeekends={false} onToggle={onToggle} />)

    fireEvent.click(screen.getByLabelText('Include weekends'))

    expect(onToggle).toHaveBeenCalledWith(true)
    expect(localStorage.getItem('schedule_include_weekends')).toBe('true')
  })
})
