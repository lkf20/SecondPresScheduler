# UI Color Standardization

## Overview

This document tracks the standardization of UI colors across the application. We've created a centralized color system to ensure consistency and make future updates easier.

## Implementation Status

### ✅ Completed

1. **Color System Created** (`lib/utils/colors.ts`)
   - Semantic color mappings (success, warning, error, info, neutral)
   - Coverage status colors (covered, partial, uncovered)
   - Status pill colors (draft, completed, covered, partially_covered, needs_coverage)
   - Button color variants
   - Neutral/gray color constants
   - Staffing status colors
   - Utility functions for easy color access

2. **Components Updated**
   - ✅ `CoverageBadge` - Now uses standardized coverage colors
   - ✅ `CoverageStatusPill` - Updated to use standardized colors (now matches CoverageBadge)
   - ✅ `TimeOffCard` - Updated to use standardized button and chip colors
   - ✅ `DashboardClient` - Updated summary cards and staffing badges to use standardized colors

### 🔄 In Progress / TODO

1. **Additional Components to Update**
   - `CoverageSummary` - Check for color consistency
   - `SubFinderCard` - Check button and status colors
   - `RecommendedSubsList` - Check status indicator colors
   - `ContactSubPanel` - Check button and status colors
   - Other components with hardcoded colors

2. **Documentation**
   - Create color palette reference guide
   - Document usage guidelines
   - Add examples

## Color Standards

### Coverage Colors

- **Covered**: `bg-blue-50 border-blue-400 text-blue-700`
- **Partial**: `bg-yellow-50 border-yellow-300 text-yellow-700`
- **Uncovered**: `bg-orange-50 border-orange-400 text-orange-700`

### Status Colors

- **Draft**: `bg-yellow-50 border-yellow-200 text-yellow-700`
- **Completed**: `bg-green-50 border-green-200 text-green-700`
- **Covered**: Uses coverage colors (blue)
- **Partially Covered**: Uses coverage colors (yellow)
- **Needs Coverage**: Uses coverage colors (orange)

### Button Colors

- **Primary**: Uses theme variables (`bg-primary text-primary-foreground`)
- **Secondary**: Uses theme variables (`bg-secondary text-secondary-foreground`)
- **Outline**: Uses theme variables (`border border-input`)
- **Teal**: `border-teal-700 text-teal-700 hover:bg-teal-700 hover:text-white`
- **Dark**: `bg-slate-900 text-white hover:bg-slate-800`

### Neutral Colors

- **Light Background**: `bg-slate-50`
- **Light Background Hover**: `bg-slate-100`
- **Border**: `border-slate-200`
- **Border Medium**: `border-slate-300`
- **Text**: `text-slate-600`
- **Text Medium**: `text-slate-700`
- **Text Dark**: `text-slate-800`
- **Text Darker**: `text-slate-900`

### Staffing Colors

- **Use `StaffingStatusBadge`** (`components/ui/staffing-status-badge.tsx`) for all Below Required, Below Preferred, Above Target, and On Target badges. Do not recreate badge styling elsewhere.
- **Below Required**: Red (red-100, red-600) — critical
- **Below Preferred**: Amber muted (amber-50 bg, amber-700 border/text; optional lighter border) — warning
- **Adequate**: Green (on target)
- **Above Target**: Teal

See [color-consistency-review.md](color-consistency-review.md) for the full palette and guidelines.

## Usage Guidelines

### Importing Colors

```typescript
import {
  getCoverageColors,
  getCoverageColorClasses,
  getStatusColors,
  getStatusColorClasses,
  getButtonColors,
  getNeutralChipClasses,
  getStaffingColorClasses,
  neutralColors,
} from '@/lib/utils/colors'
```

### Using Coverage Colors

```typescript
// Get individual color classes
const colors = getCoverageColors('covered')
// Returns: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-700', icon: 'text-blue-600' }

// Get combined classes for className
const className = getCoverageColorClasses('covered')
// Returns: 'bg-blue-50 border-blue-400 text-blue-700'
```

### Using Status Colors

```typescript
const className = getStatusColorClasses('partially_covered')
// Returns: 'bg-yellow-50 border-yellow-300 text-yellow-700'
```

### Using Button Colors

```typescript
const buttonClasses = getButtonColors('teal').base
// Returns: 'border-teal-700 text-teal-700 hover:bg-teal-700 hover:text-white'
```

### Using Neutral Colors

```typescript
// For chips
const chipClasses = getNeutralChipClasses()
// Returns: 'bg-slate-50 border-slate-200 text-slate-600'

// For individual properties
const bgClass = neutralColors.bgLight // 'bg-slate-50'
const textClass = neutralColors.textMedium // 'text-slate-700'
```

### Using StaffingStatusBadge

```typescript
import { StaffingStatusBadge } from '@/components/ui/staffing-status-badge'

// Compact badge (header, inline list)
<StaffingStatusBadge
  status="below_preferred"
  label="Below Preferred by 1"
  size="sm"
/>

// Larger badge (dashboard cards)
<StaffingStatusBadge
  status="below_required"
  label="Below Required by 2"
  size="md"
/>
```

## Migration Checklist

When updating a component to use standardized colors:

1. ✅ Import color utilities from `@/lib/utils/colors`
2. ✅ Replace hardcoded color classes with utility functions
3. ✅ Ensure coverage colors match the standard (blue for covered, yellow for partial, orange for uncovered)
4. ✅ Replace mixed `slate`/`gray` usage with consistent `slate`
5. ✅ Use `getNeutralChipClasses()` for light gray chips
6. ✅ Test visual appearance to ensure no regressions

## Notes

- **Staffing badges:** Use `StaffingStatusBadge` for Below Required, Below Preferred, Above Target, and On Target—do not recreate badge styling.
- All coverage-related components should use `getCoverageColors()` or `getCoverageColorClasses()`
- Status pills should use `getStatusColors()` or `getStatusColorClasses()`
- Light gray chips should use `getNeutralChipClasses()`
- Button colors should use `getButtonColors()` for custom buttons, or Button component variants for standard buttons
- Always prefer using utility functions or shared components over hardcoded color classes
