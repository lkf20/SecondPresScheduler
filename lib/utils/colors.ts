/**
 * Standardized Color System
 *
 * This file provides a centralized system for UI colors across the application.
 * All color usage should reference these constants and utilities to ensure consistency.
 */

// ============================================================================
// SEMANTIC COLOR MAPPINGS
// ============================================================================

export type SemanticColor = 'success' | 'warning' | 'error' | 'info' | 'neutral'

export const semanticColors = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: 'text-green-600',
  },
  warning: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    icon: 'text-yellow-600',
  },
  error: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    icon: 'text-orange-600',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    icon: 'text-blue-600',
  },
  neutral: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-600',
    icon: 'text-slate-500',
  },
} as const

// ============================================================================
// COVERAGE STATUS COLORS
// ============================================================================

export type CoverageType = 'covered' | 'partial' | 'uncovered'

/**
 * Standardized colors for coverage status badges
 * Used by CoverageBadge and all coverage-related components
 */
/**
 * RGB color values for coverage badges
 * Used for inline styles to ensure they override conflicting CSS
 * These match Tailwind's color palette
 */
export const coverageColorValues = {
  covered: {
    bg: 'rgb(246, 253, 251)', // very light green/teal tint
    border: 'rgb(196, 234, 226)', // slightly darker border
    text: 'rgb(15, 118, 110)', // teal-700
    icon: 'rgb(13, 148, 136)', // teal-600
  },
  partial: {
    bg: 'rgb(254, 252, 232)', // yellow-50
    border: 'rgb(253, 224, 71)', // yellow-300
    text: 'rgb(202, 138, 4)', // yellow-600 (darker yellow, less amber)
    icon: 'rgb(202, 138, 4)', // yellow-600
  },
  uncovered: {
    bg: 'rgb(243, 244, 246)', // gray-100
    border: 'rgb(209, 213, 219)', // gray-300
    text: 'rgb(234, 88, 12)', // orange-600
    icon: 'rgb(234, 88, 12)', // orange-600
  },
} as const

export const coverageColors = {
  covered: {
    bg: 'bg-teal-50',
    border: 'border-teal-300',
    text: 'text-teal-700',
    icon: 'text-teal-600',
  },
  partial: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    text: 'text-yellow-700',
    icon: 'text-yellow-600',
  },
  uncovered: {
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    text: 'text-orange-600',
    icon: 'text-orange-600',
  },
} as const

/**
 * Get coverage color classes
 */
export function getCoverageColors(type: CoverageType) {
  return coverageColors[type]
}

/**
 * Get coverage color classes as a single string for className
 * Note: Using explicit border utilities to avoid twMerge conflicts
 * Separating border classes to prevent twMerge from merging them incorrectly
 */
export function getCoverageColorClasses(type: CoverageType): string {
  const colors = getCoverageColors(type)
  // Return classes in a specific order to avoid twMerge conflicts
  // Background first, then border utilities separately
  return `${colors.bg} ${colors.text} border-[1px] border-solid ${colors.border}`
}

// ============================================================================
// STATUS PILL COLORS
// ============================================================================

export type StatusType = 'draft' | 'completed' | 'covered' | 'partially_covered' | 'needs_coverage'

/**
 * Standardized colors for status pills
 * Note: 'covered' and 'partially_covered' use coverageColors for consistency
 */
export const statusColors = {
  draft: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    icon: 'text-yellow-600',
  },
  completed: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    icon: 'text-green-600',
  },
  covered: coverageColors.covered, // Use coverage colors for consistency
  partially_covered: coverageColors.partial, // Use coverage colors for consistency
  needs_coverage: coverageColors.uncovered, // Use coverage colors for consistency
} as const

/**
 * Get status color classes
 */
export function getStatusColors(status: StatusType) {
  return statusColors[status]
}

/**
 * Get status color classes as a single string for className
 */
export function getStatusColorClasses(status: StatusType): string {
  const colors = getStatusColors(status)
  return `border border-solid ${colors.bg} ${colors.border} ${colors.text}`
}

// ============================================================================
// BUTTON COLORS
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'teal' | 'dark'

/**
 * Standardized button color classes
 * For theme-based buttons, use the Button component variants
 * These are for custom button styling when needed
 */
export const buttonColors = {
  primary: {
    base: 'bg-primary text-primary-foreground hover:bg-primary/90',
    // Uses theme variables
  },
  secondary: {
    base: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    // Uses theme variables
  },
  outline: {
    base: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    // Uses theme variables
  },
  teal: {
    base: 'border-teal-700 text-teal-700 hover:bg-teal-700 hover:text-white hover:border-teal-700',
    // Custom teal for "Find Sub" buttons
  },
  dark: {
    base: 'bg-button-fill text-button-fill-foreground hover:bg-button-fill-hover',
    // Dark button for selected states - uses theme variable (dark navy in accented theme)
  },
  ghost: {
    base: 'hover:bg-accent hover:text-accent-foreground',
    // Uses theme variables
  },
} as const

/**
 * Get button color classes
 */
export function getButtonColors(variant: ButtonVariant) {
  return buttonColors[variant]
}

// ============================================================================
// NEUTRAL COLORS
// ============================================================================

/**
 * Standardized neutral/gray colors
 * Use 'slate' consistently instead of mixing 'slate' and 'gray'
 */
export const neutralColors = {
  // Light backgrounds
  bgLight: 'bg-slate-50',
  bgLightHover: 'bg-slate-100',

  // Borders
  border: 'border-slate-200',
  borderMedium: 'border-slate-300',

  // Text
  text: 'text-slate-600',
  textMedium: 'text-slate-700',
  textDark: 'text-slate-800',
  textDarker: 'text-slate-900',

  // For light chips/badges
  chip: {
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    text: 'text-slate-600',
    hover: 'hover:bg-slate-100',
  },
} as const

/**
 * Get neutral color classes for chips
 */
export function getNeutralChipClasses(): string {
  return `border border-solid ${neutralColors.chip.bg} ${neutralColors.chip.border} ${neutralColors.chip.text}`
}

// ============================================================================
// STAFFING COLORS
// ============================================================================

export type StaffingStatus = 'below_required' | 'below_preferred' | 'adequate'

/**
 * Standardized colors for staffing status badges
 */
export const staffingColors = {
  below_required: {
    bg: 'bg-blue-100',
    border: 'border-blue-600',
    text: 'text-blue-600',
  },
  below_preferred: {
    bg: 'bg-blue-100',
    border: 'border-blue-600',
    text: 'text-blue-600',
  },
  adequate: {
    bg: neutralColors.bgLight,
    border: neutralColors.border,
    text: neutralColors.textMedium,
  },
} as const

/**
 * RGB color values for staffing badges
 * Used for inline styles to ensure they override conflicting CSS
 */
export const staffingColorValues = {
  below_required: {
    bg: 'rgb(219, 234, 254)', // blue-100
    border: 'rgb(37, 99, 235)', // blue-600
    text: 'rgb(37, 99, 235)', // blue-600
  },
  below_preferred: {
    bg: 'rgb(219, 234, 254)', // blue-100
    border: 'rgb(37, 99, 235)', // blue-600
    text: 'rgb(37, 99, 235)', // blue-600
  },
  adequate: {
    bg: 'rgb(248, 250, 252)', // slate-50
    border: 'rgb(226, 232, 240)', // slate-200
    text: 'rgb(71, 85, 105)', // slate-600
  },
} as const

/**
 * Get staffing color classes
 */
export function getStaffingColors(status: StaffingStatus) {
  return staffingColors[status]
}

/**
 * Get staffing color classes as a single string for className
 */
export function getStaffingColorClasses(status: StaffingStatus): string {
  const colors = getStaffingColors(status)
  return `border border-solid ${colors.bg} ${colors.border} ${colors.text}`
}

// ============================================================================
// SHIFT STATUS COLORS
// ============================================================================

export type ShiftStatus = 'assigned' | 'available' | 'unavailable'

/**
 * RGB color values for shift status chips
 * Used for inline styles to ensure they override conflicting CSS
 */
export const shiftStatusColorValues = {
  assigned: {
    bg: 'rgb(239, 246, 255)', // blue-50
    border: 'rgb(191, 219, 254)', // blue-200
    text: 'rgb(30, 58, 138)', // blue-900
  },
  available: {
    bg: 'rgb(240, 253, 250)', // teal-50 #f0fdfa
    border: 'rgb(153, 246, 228)', // teal-200
    text: 'rgb(13, 148, 136)', // teal-600 #0D9488
  },
  unavailable: {
    bg: 'rgb(243, 244, 246)', // gray-100
    border: 'rgb(209, 213, 219)', // gray-300
    text: 'rgb(55, 65, 81)', // gray-700
  },
  declined: {
    bg: 'rgb(243, 244, 246)', // gray-100
    border: 'rgb(209, 213, 219)', // gray-300
    text: 'rgb(75, 85, 99)', // gray-600
  },
} as const

/**
 * Standardized colors for shift status chips
 * Used in ShiftChips and related components
 */
export const shiftStatusColors = {
  assigned: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    // Uses same as covered for consistency
  },
  available: {
    bg: 'bg-teal-50', // #f0fdfa (lighter than #CCFBF1)
    border: 'border-teal-200',
    text: 'text-teal-600', // #0D9488
  },
  unavailable: {
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    text: 'text-gray-700',
  },
  // For declined state (all gray)
  declined: {
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    text: 'text-gray-600',
  },
} as const

/**
 * Get shift status color classes
 */
export function getShiftStatusColors(status: ShiftStatus | 'declined') {
  return shiftStatusColors[status]
}

/**
 * Get shift status color classes as a single string for className
 */
export function getShiftStatusColorClasses(status: ShiftStatus | 'declined'): string {
  const colors = getShiftStatusColors(status)
  return `border border-solid ${colors.bg} ${colors.border} ${colors.text}`
}

// ============================================================================
// HEADER STYLES
// ============================================================================

export type HeaderSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'

/**
 * Standardized header styling
 * Use these utilities to ensure consistent header appearance across the app
 */
export const headerStyles = {
  sm: 'text-sm font-bold text-slate-900',
  md: 'text-base font-bold text-slate-900',
  lg: 'text-lg font-bold text-slate-900',
  xl: 'text-xl font-bold text-slate-900',
  '2xl': 'text-2xl font-bold text-slate-900',
  '3xl': 'text-3xl font-bold tracking-tight text-slate-900',
} as const

/**
 * Get header classes by size
 * @param size - Header size (sm, md, lg, xl, 2xl, 3xl)
 * @returns Tailwind classes for the header
 */
export function getHeaderClasses(size: HeaderSize = 'lg'): string {
  return headerStyles[size]
}

// ============================================================================
// PANEL BACKGROUNDS
// ============================================================================

/**
 * Standardized background colors for right-side panel overlays
 * Used for Sheet/Modal components that slide in from the right
 */
export const panelBackgrounds = {
  // Main panel background - light gray for subtle distinction from main content
  panel: 'bg-gray-50',
  // Panel header background (for sticky headers)
  panelHeader: 'bg-gray-50',
  // Panel border (subtle separation)
  panelBorder: 'border-gray-200',
  // White card backgrounds within panels
  panelCard: 'bg-white',
  // Card border within panels
  panelCardBorder: 'border-gray-200',
} as const

/**
 * Get panel background classes
 * @returns Tailwind classes for panel background
 */
export function getPanelBackgroundClasses(): string {
  return panelBackgrounds.panel
}

/**
 * Get panel header background classes
 * @returns Tailwind classes for panel header background
 */
export function getPanelHeaderBackgroundClasses(): string {
  return panelBackgrounds.panelHeader
}

/**
 * Get complete panel SheetContent classes
 * Includes background, overflow, and standard sizing
 * @param additionalClasses - Optional additional classes to append
 * @returns Complete className string for SheetContent
 */
export function getPanelSheetContentClasses(additionalClasses?: string): string {
  const base = `${panelBackgrounds.panel} overflow-y-auto`
  return additionalClasses ? `${base} ${additionalClasses}` : base
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Combine color classes into a single string
 */
export function combineColorClasses(...classes: (string | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
