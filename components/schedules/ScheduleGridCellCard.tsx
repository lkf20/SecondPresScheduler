'use client'

import React from 'react'
import ScheduleCell from './ScheduleCell'
import { SCHEDULE_INACTIVE_CARD_CLASS } from '@/lib/ui/schedule-inactive-tokens'

type ScheduleCellData = React.ComponentProps<typeof ScheduleCell>['data']
type DisplayMode = React.ComponentProps<typeof ScheduleCell>['displayMode']

interface ScheduleGridCellCardProps {
  data?: ScheduleCellData
  displayMode?: DisplayMode
  allowCardClick: boolean
  isInactive: boolean
  onClick?: () => void
}

/**
 * Shared clickable card wrapper for schedule grid cells. Used by both
 * Days x Classrooms and Classrooms x Days layouts for consistent styling.
 */
export default function ScheduleGridCellCard({
  data,
  displayMode = 'all-scheduled-staff',
  allowCardClick,
  isInactive,
  onClick,
}: ScheduleGridCellCardProps) {
  return (
    <div
      className={`rounded-lg border border-gray-200 shadow-sm transition-all duration-200 min-h-[120px] flex-shrink-0 ${
        isInactive ? SCHEDULE_INACTIVE_CARD_CLASS : 'bg-white'
      } ${allowCardClick ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}`}
      style={{
        width: '220px',
        minWidth: '220px',
        maxWidth: '220px',
        marginTop: '6px',
        marginBottom: '6px',
        marginLeft: '10px',
        marginRight: '10px',
      }}
      onClick={allowCardClick ? onClick : undefined}
    >
      <ScheduleCell data={data} displayMode={displayMode} />
    </div>
  )
}
