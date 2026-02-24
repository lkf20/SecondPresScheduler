import { render, screen } from '@testing-library/react'
import SubCardHeader from '@/components/sub-finder/SubCardHeader'

describe('SubCardHeader', () => {
  it('renders name, phone, and coverage summary by default', () => {
    render(<SubCardHeader name="Sally A." phone="555-111-2222" shiftsCovered={2} totalShifts={3} />)

    expect(screen.getByText('Sally A.')).toBeInTheDocument()
    expect(screen.getByText('555-111-2222')).toBeInTheDocument()
    expect(screen.getByText('2/3 remaining shifts')).toBeInTheDocument()
  })

  it('renders declined state when marked declined', () => {
    render(
      <SubCardHeader name="Sally A." phone={null} shiftsCovered={0} totalShifts={3} isDeclined />
    )

    expect(screen.getByText(/declined all shifts/i)).toBeInTheDocument()
  })

  it('hides coverage block when showCoverage is false', () => {
    render(
      <SubCardHeader
        name="Sally A."
        phone={null}
        shiftsCovered={1}
        totalShifts={2}
        showCoverage={false}
      />
    )

    expect(screen.queryByText(/remaining shifts/i)).not.toBeInTheDocument()
  })
})
