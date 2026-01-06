import { render } from '@testing-library/react'
import LoadingSpinner from '../LoadingSpinner'

describe('LoadingSpinner', () => {
  it('should render spinner', () => {
    const { container } = render(<LoadingSpinner />)
    const spinner = container.querySelector('svg')
    expect(spinner).toBeInTheDocument()
  })

  it('should apply default size (md)', () => {
    const { container } = render(<LoadingSpinner />)
    const spinner = container.querySelector('svg')
    expect(spinner).toHaveClass('h-8', 'w-8')
  })

  it('should apply small size', () => {
    const { container } = render(<LoadingSpinner size="sm" />)
    const spinner = container.querySelector('svg')
    expect(spinner).toHaveClass('h-4', 'w-4')
  })

  it('should apply large size', () => {
    const { container } = render(<LoadingSpinner size="lg" />)
    const spinner = container.querySelector('svg')
    expect(spinner).toHaveClass('h-12', 'w-12')
  })

  it('should apply custom className', () => {
    const { container } = render(<LoadingSpinner className="custom-class" />)
    const spinner = container.querySelector('svg')
    expect(spinner).toHaveClass('custom-class')
  })

  it('should have animate-spin class', () => {
    const { container } = render(<LoadingSpinner />)
    const spinner = container.querySelector('svg')
    expect(spinner).toHaveClass('animate-spin')
  })
})

