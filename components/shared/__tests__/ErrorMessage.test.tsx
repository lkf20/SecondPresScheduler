import { render, screen } from '@testing-library/react'
import ErrorMessage from '../ErrorMessage'

describe('ErrorMessage', () => {
  it('should render error message', () => {
    render(<ErrorMessage message="Test error message" />)
    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <ErrorMessage message="Test error" className="custom-class" />
    )
    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should display alert icon', () => {
    render(<ErrorMessage message="Test error" />)
    // Check for the AlertCircle icon (it should be present in the DOM)
    const icon = document.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })
})



