import { fireEvent, render, screen } from '@testing-library/react'
import ClassroomColorPicker from '@/components/settings/ClassroomColorPicker'

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    type,
    className,
  }: {
    children: React.ReactNode
    onClick?: () => void
    type?: 'button' | 'submit' | 'reset'
    className?: string
  }) => (
    <button type={type || 'button'} onClick={onClick} className={className}>
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}))

jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('ClassroomColorPicker', () => {
  it('selects a predefined color and triggers onChange', () => {
    const onChange = jest.fn()

    render(<ClassroomColorPicker value={null} onChange={onChange} />)

    const maroonButton = screen.getByTitle('Maroon')
    fireEvent.click(maroonButton)

    expect(onChange).toHaveBeenCalledWith('#991B1B')
  })

  it('shows selected color name and clears selected color', () => {
    const onChange = jest.fn()

    render(<ClassroomColorPicker value="#14B8A6" onChange={onChange} />)

    expect(screen.getAllByText('Teal').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: /clear color/i }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
