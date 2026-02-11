'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, CheckCircle2, AlertCircle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import ErrorMessage from '@/components/shared/ErrorMessage'
import DuplicateResolutionDialog, {
  type DuplicateMatch,
  type TeacherImport,
} from './DuplicateResolutionDialog'

interface ParsedTeacher {
  name: string
  display_name?: string
  email: string
  phone?: string
  staff_role?: string
  status?: string
  is_sub?: string
  rowNumber: number
  errors: string[]
  warnings: string[]
}

interface TeacherCSVUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete: () => void
}

type StaffRoleType = {
  id: string
  label: string
}

type ImportResult = {
  success: number
  replaced: number
  skipped: number
  errors: number
  errorDetails: Array<{ row: number; message: string }>
}

type DuplicateResolutionAction = 'keep' | 'skip' | 'replace'

export default function TeacherCSVUploadModal({
  isOpen,
  onClose,
  onImportComplete,
}: TeacherCSVUploadModalProps) {
  const [parsedData, setParsedData] = useState<ParsedTeacher[]>([])
  const [roleTypes, setRoleTypes] = useState<StaffRoleType[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResults, setImportResults] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [pendingImport, setPendingImport] = useState<TeacherImport[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch role types on mount
  useEffect(() => {
    if (isOpen) {
      fetch('/api/staff-role-types')
        .then(r => r.json())
        .then(data => {
          const items = Array.isArray(data)
            ? (data as Array<{ id?: unknown; label?: unknown }>)
            : []
          const normalized = items.flatMap(item => {
            if (!item?.id || !item?.label) return []
            return [{ id: String(item.id), label: String(item.label) }]
          })
          setRoleTypes(normalized)
        })
        .catch(err => {
          console.error('Failed to fetch role types:', err)
        })
    }
  }, [isOpen])

  const downloadTemplate = () => {
    const csvContent = `Name,Display Name,Email,Phone,Staff Role,Status,Is also a sub
John Doe,John,john.doe@example.com,555-1234,Permanent,Active,Yes
Jane Smith,Jane,jane.smith@example.com,,Flexible,Active,No
Bob Johnson,,bob@example.com,555-5678,Permanent,Active,`

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'teachers-import-template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const parseName = (name: string): { first_name: string; last_name: string } => {
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) {
      return { first_name: parts[0], last_name: '' }
    } else {
      const last_name = parts[parts.length - 1]
      const first_name = parts.slice(0, -1).join(' ')
      return { first_name, last_name }
    }
  }

  const parseIsSub = (value: string | undefined): boolean => {
    if (!value || value.trim() === '') return false
    const normalized = value.trim().toLowerCase()
    return ['yes', 'y', 'true', '1'].includes(normalized)
  }

  const parseStatus = (value: string | undefined): boolean => {
    if (!value || value.trim() === '') return true // Default to Active
    const normalized = value.trim().toLowerCase()
    return ['active', 'a', 'yes', 'y', 'true', '1'].includes(normalized)
  }

  const findRoleTypeId = (label: string | undefined): string | null => {
    if (!label || !label.trim()) return null
    const normalized = label.trim().toLowerCase()
    const roleType = roleTypes.find(rt => rt.label.toLowerCase() === normalized)
    return roleType?.id || null
  }

  const validateEmail = (email: string): boolean => {
    if (!email || email.trim() === '') return false
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  // Simple CSV parser that handles quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const nextChar = line[i + 1]

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"'
          i++
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    // Add last field
    result.push(current.trim())
    return result
  }

  const parseCSV = (text: string): ParsedTeacher[] => {
    const lines = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
    if (lines.length < 2) {
      throw new Error('CSV must have at least a header row and one data row')
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim())
    const nameIndex = headers.findIndex(h => h.toLowerCase() === 'name')
    const displayNameIndex = headers.findIndex(h => h.toLowerCase() === 'display name')
    const emailIndex = headers.findIndex(h => h.toLowerCase() === 'email')
    const phoneIndex = headers.findIndex(h => h.toLowerCase() === 'phone')
    const staffRoleIndex = headers.findIndex(h => h.toLowerCase() === 'staff role')
    const statusIndex = headers.findIndex(h => h.toLowerCase() === 'status')
    const isSubIndex = headers.findIndex(
      h => h.toLowerCase() === 'is also a sub' || h.toLowerCase() === 'is sub'
    )

    if (nameIndex === -1) {
      throw new Error('CSV must have "Name" column')
    }

    const parsed: ParsedTeacher[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      const rowNumber = i + 1
      const errors: string[] = []
      const warnings: string[] = []

      const name = values[nameIndex] || ''
      const email = emailIndex !== -1 ? values[emailIndex] || '' : ''
      const displayName = displayNameIndex !== -1 ? values[displayNameIndex] : undefined
      const phone = phoneIndex !== -1 ? values[phoneIndex] : undefined
      const staffRole = staffRoleIndex !== -1 ? values[staffRoleIndex] : undefined
      const status = statusIndex !== -1 ? values[statusIndex] : undefined
      const isSub = isSubIndex !== -1 ? values[isSubIndex] : undefined

      // Validate required fields
      if (!name || name.trim() === '') {
        errors.push('Name is required')
      }
      // Email is optional, but if provided, must be valid
      if (email && email.trim() !== '' && !validateEmail(email)) {
        errors.push('Invalid email format')
      }

      // Validate staff role
      if (staffRole && staffRole.trim()) {
        const roleTypeId = findRoleTypeId(staffRole)
        if (!roleTypeId) {
          warnings.push(
            `Staff Role "${staffRole}" not found. Available: ${roleTypes.map(rt => rt.label).join(', ')}`
          )
        }
      }

      // Validate status
      if (status && status.trim()) {
        const normalized = status.trim().toLowerCase()
        if (
          ![
            'active',
            'inactive',
            'a',
            'i',
            'yes',
            'no',
            'y',
            'n',
            'true',
            'false',
            '1',
            '0',
          ].includes(normalized)
        ) {
          warnings.push(`Invalid Status value "${status}". Use "Active" or "Inactive"`)
        }
      }

      // Validate is_sub
      if (isSub && isSub.trim()) {
        const normalized = isSub.trim().toLowerCase()
        if (!['yes', 'no', 'y', 'n', 'true', 'false', '1', '0'].includes(normalized)) {
          warnings.push(`Invalid "Is also a sub" value "${isSub}". Use "Yes" or "No"`)
        }
      }

      parsed.push({
        name,
        display_name: displayName,
        email,
        phone,
        staff_role: staffRole,
        status,
        is_sub: isSub,
        rowNumber,
        errors,
        warnings,
      })
    }

    return parsed
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    setError(null)
    setImportResults(null)
    setIsValidating(true)

    try {
      const text = await selectedFile.text()
      const parsed = parseCSV(text)
      setParsedData(parsed)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to parse CSV file'
      setError(message)
      setParsedData([])
    } finally {
      setIsValidating(false)
    }
  }

  const checkDuplicates = async (teachersToImport: TeacherImport[]): Promise<DuplicateMatch[]> => {
    try {
      const response = await fetch('/api/teachers/check-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teachers: teachersToImport }),
      })

      if (!response.ok) {
        throw new Error('Failed to check duplicates')
      }

      const data = await response.json()
      return Array.isArray(data?.duplicates) ? (data.duplicates as DuplicateMatch[]) : []
    } catch (err) {
      console.error('Error checking duplicates:', err)
      return []
    }
  }

  const handleImport = async () => {
    const validRows = parsedData.filter(row => row.errors.length === 0)
    if (validRows.length === 0) {
      setError('No valid rows to import. Please fix errors and try again.')
      return
    }

    setIsImporting(true)
    setError(null)

    try {
      const teachersToImport: TeacherImport[] = validRows.map(row => {
        const { first_name, last_name } = parseName(row.name)
        const roleTypeId = findRoleTypeId(row.staff_role)

        return {
          first_name,
          last_name,
          display_name: row.display_name?.trim() || null,
          email: row.email?.trim() || null,
          phone: row.phone?.trim() || null,
          role_type_ids: roleTypeId ? [roleTypeId] : [],
          active: parseStatus(row.status),
          is_sub: parseIsSub(row.is_sub),
          is_teacher: true,
        }
      })

      // Check for duplicates
      const duplicateMatches = await checkDuplicates(teachersToImport)

      if (duplicateMatches.length > 0) {
        // Show duplicate resolution dialog
        setDuplicates(duplicateMatches)
        setPendingImport(teachersToImport)
        setShowDuplicateDialog(true)
        setIsImporting(false)
        return
      }

      // No duplicates, proceed with import
      await performImport(teachersToImport, new Map())
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import teachers'
      setError(message)
      setIsImporting(false)
    }
  }

  const performImport = async (
    teachersToImport: TeacherImport[],
    resolutions: Map<number, DuplicateResolutionAction>
  ) => {
    setIsImporting(true)
    setError(null)

    try {
      const response = await fetch('/api/teachers/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teachers: teachersToImport,
          resolutions: Array.from(resolutions.entries()).map(([index, action]) => ({
            csvIndex: index,
            action,
          })),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to import teachers')
      }

      const result = await response.json()
      setImportResults(result)

      if (result.errors === 0) {
        setTimeout(() => {
          onImportComplete()
          handleClose()
        }, 2000)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import teachers'
      setError(message)
    } finally {
      setIsImporting(false)
    }
  }

  const handleDuplicateResolve = (resolutions: Map<number, DuplicateResolutionAction>) => {
    setShowDuplicateDialog(false)
    performImport(pendingImport, resolutions)
  }

  const handleDuplicateCancel = () => {
    setShowDuplicateDialog(false)
    setDuplicates([])
    setPendingImport([])
    setIsImporting(false)
  }

  const handleClose = () => {
    setParsedData([])
    setImportResults(null)
    setError(null)
    setDuplicates([])
    setShowDuplicateDialog(false)
    setPendingImport([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  const validRows = parsedData.filter(row => row.errors.length === 0)
  const invalidRows = parsedData.filter(row => row.errors.length > 0)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Teachers CSV</DialogTitle>
          <DialogDescription>
            Import multiple teachers from a CSV file. Download the template to see the required
            format.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Instructions */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <h3 className="font-medium mb-2">CSV Format:</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>
                <strong>Name</strong> (required): Full name or &quot;First Last&quot;
              </li>
              <li>
                <strong>Display Name</strong> (optional): Preferred display name
              </li>
              <li>
                <strong>Email</strong> (optional): Valid email address
              </li>
              <li>
                <strong>Phone</strong> (optional): Phone number
              </li>
              <li>
                <strong>Staff Role</strong> (optional): &quot;Permanent&quot; or
                &quot;Flexible&quot;
              </li>
              <li>
                <strong>Status</strong> (optional): &quot;Active&quot; or &quot;Inactive&quot;
                (defaults to Active)
              </li>
              <li>
                <strong>Is also a sub</strong> (optional): &quot;Yes&quot; or &quot;No&quot;
                (defaults to No)
              </li>
            </ul>
          </div>

          {/* Download Template Button */}
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={downloadTemplate}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Download Template CSV
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="csv-file">Select CSV File</Label>
            <Input
              id="csv-file"
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              disabled={isValidating || isImporting}
            />
          </div>

          {error && <ErrorMessage message={error} />}

          {/* Validation Results */}
          {parsedData.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <span className="font-medium text-green-600">{validRows.length} valid</span>
                  {invalidRows.length > 0 && (
                    <>
                      {' • '}
                      <span className="font-medium text-red-600">
                        {invalidRows.length} with errors
                      </span>
                    </>
                  )}
                </div>
                {validRows.length > 0 && (
                  <Button onClick={handleImport} disabled={isImporting}>
                    {isImporting ? 'Importing...' : `Import ${validRows.length} Teachers`}
                  </Button>
                )}
              </div>

              {/* Preview Table */}
              <div className="border rounded-md max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Staff Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Is Sub</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map(row => (
                      <TableRow
                        key={row.rowNumber}
                        className={
                          row.errors.length > 0
                            ? 'bg-red-50'
                            : row.warnings.length > 0
                              ? 'bg-yellow-50'
                              : ''
                        }
                      >
                        <TableCell className="font-medium">{row.rowNumber}</TableCell>
                        <TableCell>{row.name}</TableCell>
                        <TableCell>{row.email || '—'}</TableCell>
                        <TableCell>{row.phone || '—'}</TableCell>
                        <TableCell>{row.staff_role || '—'}</TableCell>
                        <TableCell>{row.status || 'Active (default)'}</TableCell>
                        <TableCell>
                          {row.is_sub ? (parseIsSub(row.is_sub) ? 'Yes' : 'No') : 'No (default)'}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {row.errors.map((err, idx) => (
                              <div
                                key={idx}
                                className="text-xs text-red-600 flex items-center gap-1"
                              >
                                <AlertCircle className="h-3 w-3" />
                                {err}
                              </div>
                            ))}
                            {row.warnings.map((warn, idx) => (
                              <div
                                key={idx}
                                className="text-xs text-yellow-600 flex items-center gap-1"
                              >
                                <AlertCircle className="h-3 w-3" />
                                {warn}
                              </div>
                            ))}
                            {row.errors.length === 0 && row.warnings.length === 0 && (
                              <div className="text-xs text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Valid
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Import Results */}
          {importResults && (
            <div className="rounded-lg border p-4 space-y-2">
              <h3 className="font-medium">Import Results:</h3>
              <div className="text-sm space-y-1">
                <div className="text-green-600">
                  ✓ Successfully imported: {importResults.success} teachers
                </div>
                {importResults.replaced > 0 && (
                  <div className="text-blue-600">
                    ↻ Replaced: {importResults.replaced} existing teachers
                  </div>
                )}
                {importResults.skipped > 0 && (
                  <div className="text-yellow-600">⚠ Skipped: {importResults.skipped} teachers</div>
                )}
                {importResults.errors > 0 && (
                  <div className="text-red-600">✗ Errors: {importResults.errors} teachers</div>
                )}
              </div>
              {importResults.errorDetails && importResults.errorDetails.length > 0 && (
                <div className="mt-2 text-sm text-red-600">
                  <div className="font-medium">Error Details:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {importResults.errorDetails.map((detail, idx) => (
                      <li key={idx}>
                        Row {detail.row}: {detail.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Duplicate Resolution Dialog */}
        <DuplicateResolutionDialog
          isOpen={showDuplicateDialog}
          duplicates={duplicates}
          onResolve={handleDuplicateResolve}
          onCancel={handleDuplicateCancel}
        />
      </DialogContent>
    </Dialog>
  )
}
