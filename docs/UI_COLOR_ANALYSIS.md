# UI Color System Analysis

## Current State Assessment

### ✅ What We Have

1. **Theme System (CSS Variables)**
   - Located in `app/globals.css`
   - Uses HSL color variables for theming
   - Supports light/dark mode
   - Has an "accented" theme with teal/turquoise colors
   - Theme variables defined in `tailwind.config.ts`

2. **Shared Components**
   - `CoverageBadge` component - standardizes coverage colors
   - `Button` component - uses theme variables (primary, secondary, outline, etc.)
   - `CoverageStatusPill` component - has some coverage colors

### ❌ What's Missing / Inconsistent

1. **No Centralized Color Constants**
   - Colors are hardcoded throughout components using Tailwind classes
   - No single source of truth for semantic colors (e.g., "success", "warning", "error")
   - No utility functions for consistent color application

2. **Inconsistent Color Usage**

   **Coverage Status Colors:**
   - `CoverageBadge`: 
     - Covered: `bg-blue-50 border-blue-400 text-blue-700`
     - Partial: `bg-yellow-50 border-yellow-300 text-yellow-700`
     - Uncovered: `bg-orange-50 border-orange-400 text-orange-700`
   - `CoverageStatusPill`:
     - Covered: `bg-green-50 border-green-200 text-green-700` (different from CoverageBadge!)
     - Partial: `bg-yellow-50 border-yellow-200 text-yellow-700` (slightly different)
     - Needs coverage: `bg-orange-100 border-orange-200 text-orange-900` (different shades)
   - Dashboard summary cards use various shades

   **Button Colors:**
   - Primary buttons: Use theme `primary` (teal in accented theme)
   - "Find Sub" buttons: Hardcoded `border-teal-700 text-teal-700 hover:bg-teal-700`
   - Some buttons use `bg-slate-900` for dark buttons
   - Inconsistent hover states

   **Neutral/Gray Colors:**
   - Mixed usage of `slate` and `gray` (e.g., `bg-slate-50`, `bg-gray-50`, `bg-gray-100`)
   - Light chips use: `bg-slate-50 border-slate-200 text-slate-600`
   - Some use `bg-gray-50` or `bg-gray-100`

   **Status/State Colors:**
   - Staffing badges: `bg-amber-100 text-amber-900 border-amber-200` (below required)
   - Draft status: `bg-yellow-50 border-yellow-200 text-yellow-700`
   - Completed: `bg-green-50 border-green-200 text-green-700`

3. **No Semantic Color Mapping**
   - No clear mapping of "success" → green, "warning" → yellow, "error" → red/orange
   - Coverage status uses different colors in different places
   - No standardized "info", "success", "warning", "error" color system

4. **Inconsistent Shade Usage**
   - Some use `-50` backgrounds with `-700` text
   - Some use `-100` backgrounds with `-900` text
   - Border colors vary (sometimes `-200`, sometimes `-300`, sometimes `-400`)

## Current Color Patterns Found

### Coverage Colors
- **Covered**: Blue (`blue-50/400/700`) OR Green (`green-50/200/700`) - inconsistent!
- **Partial**: Yellow (`yellow-50/200-300/700`) - mostly consistent
- **Uncovered**: Orange (`orange-50-100/200-400/700-900`) - shades vary

### Button Colors
- **Primary**: Theme variable `primary` (teal in accented theme)
- **Secondary**: Theme variable `secondary`
- **Outline**: Theme variable `input` border
- **Custom Teal**: `teal-700` for "Find Sub" buttons
- **Dark**: `slate-900` for selected states

### Neutral Colors
- **Light backgrounds**: `slate-50`, `gray-50`, `gray-100` (inconsistent)
- **Borders**: `slate-200`, `slate-300` (mostly consistent)
- **Text**: `slate-600`, `slate-700`, `slate-800`, `slate-900`

### Status Colors
- **Draft**: Yellow (`yellow-50/200/700`)
- **Completed**: Green (`green-50/200/700`)
- **Below Required**: Amber (`amber-100/200/900`)
- **Below Preferred**: Amber (`amber-50/200/800`)

## Recommendations for Standardization

1. **Create a Color Constants File**
   - Define semantic color mappings (success, warning, error, info)
   - Standardize coverage colors (covered, partial, uncovered)
   - Standardize neutral colors (light gray chips, borders, etc.)
   - Standardize button color variants

2. **Create Utility Functions**
   - `getCoverageColors(type)` - returns consistent colors for coverage badges
   - `getStatusColors(status)` - returns consistent colors for status pills
   - `getButtonColors(variant)` - returns consistent button colors
   - `getNeutralColors(level)` - returns consistent neutral colors

3. **Update Components**
   - Refactor `CoverageStatusPill` to match `CoverageBadge` colors
   - Standardize all coverage-related components
   - Update button implementations to use standardized colors
   - Replace mixed `slate`/`gray` usage with consistent choice

4. **Document Color System**
   - Create a color palette reference
   - Document when to use which colors
   - Add examples of proper usage
