import { render, screen } from '@testing-library/react'
import FormField from '../FormField'

describe('FormField', () => {
  it('should render label', () => {
    render(
      <FormField label="Test Label">
        <input type="text" />
      </FormField>
    )
    expect(screen.getByText('Test Label')).toBeInTheDocument()
  })

  it('should render required indicator when required', () => {
    render(
      <FormField label="Test Label" required>
        <input type="text" />
      </FormField>
    )
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('should not render required indicator when not required', () => {
    render(
      <FormField label="Test Label">
        <input type="text" />
      </FormField>
    )
    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  it('should render error message when provided', () => {
    render(
      <FormField label="Test Label" error="This is an error">
        <input type="text" />
      </FormField>
    )
    expect(screen.getByText('This is an error')).toBeInTheDocument()
  })

  it('should not render error message when not provided', () => {
    render(
      <FormField label="Test Label">
        <input type="text" />
      </FormField>
    )
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
  })

  it('should render description when provided', () => {
    render(
      <FormField label="Test Label" description="This is a description">
        <input type="text" />
      </FormField>
    )
    expect(screen.getByText('This is a description')).toBeInTheDocument()
  })

  it('should render children', () => {
    render(
      <FormField label="Test Label">
        <input type="text" data-testid="test-input" />
      </FormField>
    )
    expect(screen.getByTestId('test-input')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <FormField label="Test Label" className="custom-class">
        <input type="text" />
      </FormField>
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
