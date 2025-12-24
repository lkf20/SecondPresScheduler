'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  cell?: (row: T) => React.ReactNode
  sortable?: boolean
  linkBasePath?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchable?: boolean
  searchPlaceholder?: string
  onRowClick?: (row: T) => void
  className?: string
  emptyMessage?: string
}

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchable = false,
  searchPlaceholder = 'Search...',
  onRowClick,
  className,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Filter data
  const filteredData = searchable
    ? data.filter((row) =>
        columns.some((col) => {
          const value = row[col.key]
          return value?.toString().toLowerCase().includes(search.toLowerCase())
        })
      )
    : data

  // Sort data
  const sortedData = sortKey
    ? [...filteredData].sort((a, b) => {
        const aVal = a[sortKey]
        const bVal = b[sortKey]
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return sortDirection === 'asc' ? comparison : -comparison
      })
    : filteredData

  // Paginate data
  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const paginatedData = sortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  return (
    <div className={cn('space-y-4', className)}>
      {searchable && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-8"
            />
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={column.sortable ? 'cursor-pointer hover:bg-accent' : ''}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  {column.header}
                  {column.sortable && sortKey === column.key && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className={onRowClick ? 'cursor-pointer hover:bg-accent' : ''}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map((column) => {
                    // Get cell content - handle cell function if provided, otherwise use row data
                    let cellContent: any = row[column.key]
                    if (column.cell) {
                      try {
                        cellContent = column.cell(row)
                      } catch {
                        cellContent = row[column.key]
                      }
                    }
                    
                    // Construct href if linkBasePath is provided
                    let href: string | undefined
                    if (column.linkBasePath && row.id) {
                      href = `${column.linkBasePath}/${row.id}`
                    }
                    
                    // Special handling for active status
                    if (column.key === 'active' && typeof cellContent === 'boolean') {
                      cellContent = (
                        <span className={cellContent ? 'text-green-600' : 'text-gray-400'}>
                          {cellContent ? 'Active' : 'Inactive'}
                        </span>
                      )
                    }
                    
                    // Handle display_name fallback
                    if (column.key === 'display_name' && !cellContent) {
                      const firstName = row['first_name'] || ''
                      const lastName = row['last_name'] || ''
                      cellContent = `${firstName} ${lastName}`.trim() || '—'
                    }
                    
                    // Handle null/undefined values
                    if (cellContent === null || cellContent === undefined || cellContent === '') {
                      cellContent = '—'
                    }
                    
                    return (
                      <TableCell key={column.key}>
                        {href ? (
                          <Link href={href} className="hover:underline">
                            {cellContent}
                          </Link>
                        ) : (
                          cellContent
                        )}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm">
              Page {currentPage} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

