'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface SubNotesSectionProps {
  subId: string
  initialNotes: string | null
  onDirtyChange?: (dirty: boolean) => void
  externalSaveSignal?: number
}

export default function SubNotesSection({
  subId,
  initialNotes,
  onDirtyChange,
  externalSaveSignal,
}: SubNotesSectionProps) {
  const normalizedInitial = useMemo(() => initialNotes ?? '', [initialNotes])
  const [notes, setNotes] = useState(normalizedInitial)
  const [savedNotes, setSavedNotes] = useState(normalizedInitial)
  const [isSaving, setIsSaving] = useState(false)
  const handledSignalRef = useRef(0)

  useEffect(() => {
    setNotes(normalizedInitial)
    setSavedNotes(normalizedInitial)
  }, [subId, normalizedInitial])

  const isDirty = notes !== savedNotes

  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  const handleSave = useCallback(async () => {
    if (isSaving || !isDirty) return
    setIsSaving(true)
    try {
      const response = await fetch(`/api/staff/${subId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capabilities_notes: notes.trim() || null,
        }),
      })
      if (!response.ok) throw new Error('Failed to save notes')
      setSavedNotes(notes)
      toast.success('Notes saved.')
    } catch {
      toast.error('Failed to save notes.')
    } finally {
      setIsSaving(false)
    }
  }, [isDirty, isSaving, notes, subId])

  useEffect(() => {
    if (!externalSaveSignal) return
    if (externalSaveSignal === handledSignalRef.current) return
    handledSignalRef.current = externalSaveSignal
    void handleSave()
  }, [externalSaveSignal, handleSave])

  return (
    <div className="space-y-4 max-w-2xl">
      <Textarea
        id="staff-notes"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="min-h-[180px]"
        placeholder="Add notes"
      />
      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={isSaving || !isDirty}>
          {isSaving ? 'Saving...' : 'Save notes'}
        </Button>
      </div>
    </div>
  )
}
