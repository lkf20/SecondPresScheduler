'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import ScheduleCell from './ScheduleCell'
import { SCHEDULE_INACTIVE_CARD_CLASS } from '@/lib/ui/schedule-inactive-tokens'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Pencil } from 'lucide-react'

type ScheduleCellData = React.ComponentProps<typeof ScheduleCell>['data']
type DisplayMode = React.ComponentProps<typeof ScheduleCell>['displayMode']

export interface ClosureMetadata {
  id: string
  date: string
  reason: string | null
  time_slot_id: string | null
}

interface ScheduleGridCellCardProps {
  data?: ScheduleCellData
  displayMode?: DisplayMode
  /** When true, show cell notes at the bottom (from Views & Filters > Show notes) */
  showNotes?: boolean
  allowCardClick: boolean
  isInactive: boolean
  isClosed?: boolean
  closureMetadata?: ClosureMetadata | null
  onClosureMarkOpen?: (closureId: string) => void
  /** Mark the whole day open (delete whole-day closure for this date). */
  onClosureMarkOpenForDay?: (date: string) => void
  onClosureChangeReason?: (closureId: string, newReason: string) => void
  onClick?: () => void
  /** When provided, cell shows "All class groups" if it has all of these (instead of listing). */
  allClassGroupIds?: string[]
}

/**
 * Shared clickable card wrapper for schedule grid cells. Used by both
 * Days x Classrooms and Classrooms x Days layouts for consistent styling.
 */
export default function ScheduleGridCellCard({
  data,
  displayMode = 'all-scheduled-staff',
  showNotes = false,
  allowCardClick,
  isInactive,
  isClosed = false,
  closureMetadata,
  onClosureMarkOpen,
  onClosureMarkOpenForDay,
  onClosureChangeReason,
  onClick,
  allClassGroupIds,
}: ScheduleGridCellCardProps) {
  const [editReasonOpen, setEditReasonOpen] = useState(false)
  const [editReasonValue, setEditReasonValue] = useState('')
  const [popoverOpen, setPopoverOpen] = useState(false)

  const handleOpenChangeReason = () => {
    setPopoverOpen(false)
    setEditReasonValue(closureMetadata?.reason ?? '')
    setEditReasonOpen(true)
  }

  const handleMarkOpenSlot = () => {
    if (closureMetadata && onClosureMarkOpen) {
      setPopoverOpen(false)
      onClosureMarkOpen(closureMetadata.id)
    }
  }

  const handleMarkOpenDay = () => {
    if (closureMetadata && onClosureMarkOpenForDay) {
      setPopoverOpen(false)
      onClosureMarkOpenForDay(closureMetadata.date)
    }
  }

  const handleSaveReason = () => {
    if (closureMetadata && onClosureChangeReason) {
      onClosureChangeReason(closureMetadata.id, editReasonValue.trim())
      setEditReasonOpen(false)
    }
  }

  if (isClosed) {
    return (
      <>
        <div
          className="rounded-lg border border-gray-200 shadow-sm min-h-[120px] flex-shrink-0 h-full bg-slate-50 flex flex-col items-center justify-center px-2 py-3"
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
          }}
        >
          <span className="text-sm font-medium text-slate-500">School Closed</span>
          {closureMetadata?.reason && (
            <span className="text-xs text-slate-600 mt-1 text-center line-clamp-2">
              {closureMetadata.reason}
            </span>
          )}
          {(onClosureMarkOpen || onClosureChangeReason || onClosureMarkOpenForDay) &&
            closureMetadata && (
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 mt-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
                          aria-label="Edit closure"
                          onClick={e => e.stopPropagation()}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </PopoverTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Edit school closure</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <PopoverContent
                  className="w-56 p-2"
                  align="center"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="space-y-1">
                    {onClosureMarkOpen && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm font-normal"
                        onClick={handleMarkOpenSlot}
                      >
                        Mark open for this time slot
                      </Button>
                    )}
                    {onClosureMarkOpenForDay && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm font-normal"
                        onClick={handleMarkOpenDay}
                      >
                        Mark open for this day
                      </Button>
                    )}
                    {onClosureChangeReason && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-sm font-normal"
                        onClick={handleOpenChangeReason}
                      >
                        Change reason
                      </Button>
                    )}
                    <div className="border-t border-slate-200 my-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sm font-normal"
                      asChild
                      onClick={() => setPopoverOpen(false)}
                    >
                      <Link href="/settings/calendar">Open Calendar Settings</Link>
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
        </div>

        <Dialog open={editReasonOpen} onOpenChange={setEditReasonOpen}>
          <DialogContent className="sm:max-w-md" onClick={e => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Change closure reason</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="closure-reason">Reason</Label>
              <Input
                id="closure-reason"
                value={editReasonValue}
                onChange={e => setEditReasonValue(e.target.value)}
                placeholder="e.g. Thanksgiving"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditReasonOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveReason}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div
      className={`rounded-lg border border-gray-200 shadow-sm transition-all duration-200 min-h-[120px] flex-shrink-0 h-full flex flex-col ${
        isInactive ? SCHEDULE_INACTIVE_CARD_CLASS : 'bg-white'
      } ${allowCardClick ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}`}
      style={{
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
      }}
      onClick={allowCardClick ? onClick : undefined}
    >
      <div className="flex-1 min-h-0 overflow-visible">
        <ScheduleCell
          data={data}
          displayMode={displayMode}
          showNotes={showNotes}
          allClassGroupIds={allClassGroupIds}
        />
      </div>
    </div>
  )
}
