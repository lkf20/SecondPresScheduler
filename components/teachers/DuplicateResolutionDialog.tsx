'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle } from 'lucide-react'

export interface TeacherImport {
  first_name: string
  last_name: string
  display_name?: string | null
  email?: string | null
  phone?: string | null
  role_type_ids?: string[]
  active: boolean
  is_sub: boolean
}

export interface DuplicateMatch {
  csvIndex: number
  csvTeacher: TeacherImport
  matchType: 'email' | 'name' | 'both'
  existingTeacher?: {
    id: string
    first_name: string
    last_name: string
    display_name: string | null
    email: string | null
    phone: string | null
  }
  withinCsv?: number[]
}

interface DuplicateResolutionDialogProps {
  isOpen: boolean
  duplicates: DuplicateMatch[]
  onResolve: (resolutions: Map<number, 'keep' | 'skip' | 'replace'>) => void
  onCancel: () => void
}

export default function DuplicateResolutionDialog({
  isOpen,
  duplicates,
  onResolve,
  onCancel,
}: DuplicateResolutionDialogProps) {
  const [resolutions, setResolutions] = useState<Map<number, 'keep' | 'skip' | 'replace'>>(
    new Map(duplicates.map(d => [d.csvIndex, d.existingTeacher ? 'replace' : 'keep']))
  )
  const [bulkAction, setBulkAction] = useState<'keep' | 'skip' | 'replace' | null>(null)

  const handleBulkAction = (action: 'keep' | 'skip' | 'replace') => {
    setBulkAction(action)
    const newResolutions = new Map<number, 'keep' | 'skip' | 'replace'>()
    duplicates.forEach(dup => {
      newResolutions.set(dup.csvIndex, action)
    })
    setResolutions(newResolutions)
  }

  const handleIndividualChange = (csvIndex: number, action: 'keep' | 'skip' | 'replace') => {
    const newResolutions = new Map(resolutions)
    newResolutions.set(csvIndex, action)
    setResolutions(newResolutions)
    setBulkAction(null) // Clear bulk action when individual change is made
  }

  const handleConfirm = () => {
    onResolve(resolutions)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Duplicate Teachers Detected</DialogTitle>
          <DialogDescription>
            {duplicates.length} duplicate{duplicates.length !== 1 ? 's' : ''} found. Choose how to
            handle each one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Bulk Actions */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <Label className="text-sm font-medium mb-2 block">Apply to All Duplicates:</Label>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={bulkAction === 'replace' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleBulkAction('replace')}
              >
                Replace All Existing
              </Button>
              <Button
                type="button"
                variant={bulkAction === 'keep' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleBulkAction('keep')}
              >
                Keep All (Import as New)
              </Button>
              <Button
                type="button"
                variant={bulkAction === 'skip' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleBulkAction('skip')}
              >
                Skip All
              </Button>
            </div>
          </div>

          {/* Duplicates Table */}
          <div className="border rounded-md max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Row</TableHead>
                  <TableHead>CSV Teacher</TableHead>
                  <TableHead>Existing Teacher</TableHead>
                  <TableHead>Match Type</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicates.map(dup => {
                  const csvName = `${dup.csvTeacher.first_name} ${dup.csvTeacher.last_name}`.trim()
                  const existingName = dup.existingTeacher
                    ? `${dup.existingTeacher.first_name} ${dup.existingTeacher.last_name}`.trim()
                    : 'N/A'
                  const resolution =
                    resolutions.get(dup.csvIndex) || (dup.existingTeacher ? 'replace' : 'keep')

                  return (
                    <TableRow key={dup.csvIndex}>
                      <TableCell className="font-medium">{dup.csvIndex + 2}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{csvName}</div>
                          {dup.csvTeacher.email && (
                            <div className="text-xs text-muted-foreground">
                              {dup.csvTeacher.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {dup.existingTeacher ? (
                          <div className="space-y-1">
                            <div className="font-medium">{existingName}</div>
                            {dup.existingTeacher.email && (
                              <div className="text-xs text-muted-foreground">
                                {dup.existingTeacher.email}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic">
                            Duplicate within CSV only
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs">
                          <AlertCircle className="h-3 w-3" />
                          {dup.matchType === 'both'
                            ? 'Email & Name'
                            : dup.matchType === 'email'
                              ? 'Email'
                              : 'Name'}
                        </div>
                        {dup.withinCsv && dup.withinCsv.length > 0 && (
                          <div className="text-xs text-yellow-600 mt-1">
                            Also matches CSV row{dup.withinCsv.length !== 1 ? 's' : ''}:{' '}
                            {dup.withinCsv.map(i => i + 2).join(', ')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <RadioGroup
                          value={resolution}
                          onValueChange={value =>
                            handleIndividualChange(
                              dup.csvIndex,
                              value as 'keep' | 'skip' | 'replace'
                            )
                          }
                        >
                          <div className="space-y-2">
                            {dup.existingTeacher && (
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="replace" id={`replace-${dup.csvIndex}`} />
                                <Label
                                  htmlFor={`replace-${dup.csvIndex}`}
                                  className="text-sm font-normal cursor-pointer"
                                >
                                  Replace Existing
                                </Label>
                              </div>
                            )}
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="keep" id={`keep-${dup.csvIndex}`} />
                              <Label
                                htmlFor={`keep-${dup.csvIndex}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                {dup.existingTeacher ? 'Keep Both' : 'Keep All'}
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="skip" id={`skip-${dup.csvIndex}`} />
                              <Label
                                htmlFor={`skip-${dup.csvIndex}`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                Skip This
                              </Label>
                            </div>
                          </div>
                        </RadioGroup>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel Import
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Continue Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
