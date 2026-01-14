export type CoverageStatus = 'uncovered' | 'partially_covered' | 'covered'

export type CoverageBadge = {
  label: string
  count: number
  tone: 'covered' | 'uncovered' | 'partial'
}

export const getCoverageStatus = ({
  uncovered,
  partiallyCovered,
}: {
  uncovered: number
  partiallyCovered: number
}): CoverageStatus => {
  if (uncovered > 0) return 'uncovered'
  if (partiallyCovered > 0) return 'partially_covered'
  return 'covered'
}

export const buildCoverageBadges = ({
  uncovered,
  partiallyCovered,
  fullyCovered,
}: {
  uncovered: number
  partiallyCovered: number
  fullyCovered: number
}): CoverageBadge[] => {
  const badges: CoverageBadge[] = []
  if (fullyCovered > 0) {
    badges.push({
      label: 'Covered',
      count: fullyCovered,
      tone: 'covered',
    })
  }
  if (uncovered > 0) {
    badges.push({
      label: 'Uncovered',
      count: uncovered,
      tone: 'uncovered',
    })
  }
  if (partiallyCovered > 0) {
    badges.push({
      label: 'Partial',
      count: partiallyCovered,
      tone: 'partial',
    })
  }
  return badges
}
