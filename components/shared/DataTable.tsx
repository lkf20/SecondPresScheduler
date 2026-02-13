'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
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
  paginate?: boolean
}

export default function DataTable<T extends Record<string, unknown>>({
  data,
  columns,
  searchable = false,
  searchPlaceholder = 'Search...',
  onRowClick,
  className,
  emptyMessage = 'No data available',
  paginate = true,
}: DataTableProps<T>) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  // Get page from URL params, default to 1
  const pageFromUrl = parseInt(searchParams.get('page') || '1', 10)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [sortKey, setSortKey] = useState<string | null>(searchParams.get('sort') || null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(
    (searchParams.get('dir') as 'asc' | 'desc') || 'asc'
  )
  const [currentPage, setCurrentPage] = useState(pageFromUrl)
  const itemsPerPage = 10

  // Sync currentPage with URL param on mount and when URL changes
  useEffect(() => {
    if (pageFromUrl !== currentPage && pageFromUrl >= 1) {
      setCurrentPage(pageFromUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageFromUrl])

  // Update URL when page changes
  const updatePageInUrl = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page === 1) {
      params.delete('page')
    } else {
      params.set('page', page.toString())
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // Filter data
  const filteredData = searchable
    ? data.filter(row =>
        columns.some(col => {
          const value = row[col.key]
          return value?.toString().toLowerCase().includes(search.toLowerCase())
        })
      )
    : data

  // Sort data
  const sortedData = sortKey
    ? [...filteredData].sort((a, b) => {
        const aVal = a[sortKey] as unknown
        const bVal = b[sortKey] as unknown
        // Handle comparison for different types
        if (aVal === bVal) return 0
        if (aVal == null) return 1
        if (bVal == null) return -1
        const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0
        return sortDirection === 'asc' ? comparison : -comparison
      })
    : filteredData

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const paginatedData = paginate
    ? sortedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : sortedData

  const handleSort = (key: string) => {
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc'
    setSortKey(key)
    setSortDirection(newDirection)

    // Update URL with sort params
    const params = new URLSearchParams(searchParams.toString())
    params.set('sort', key)
    params.set('dir', newDirection)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    updatePageInUrl(newPage)
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
              onChange={e => {
                const newSearch = e.target.value
                setSearch(newSearch)
                setCurrentPage(1)

                // Update URL with search param
                const params = new URLSearchParams(searchParams.toString())
                if (newSearch) {
                  params.set('search', newSearch)
                } else {
                  params.delete('search')
                }
                params.delete('page') // Reset to page 1 when searching
                router.push(`${pathname}?${params.toString()}`, { scroll: false })
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
              {columns.map(column => (
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
                <TableCell
                  colSpan={columns.length}
                  className="text-center py-8 text-muted-foreground"
                >
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
                  {columns.map(column => {
                    // Get cell content - handle cell function if provided, otherwise use row data
                    let cellContent = row[column.key] as unknown as React.ReactNode
                    if (column.cell) {
                      try {
                        cellContent = column.cell(row)
                      } catch {
                        cellContent = row[column.key] as unknown as React.ReactNode
                      }
                    }

                    // Construct href if linkBasePath is provided
                    // Preserve current page and search params in the link
                    let href: string | undefined
                    if (column.linkBasePath && row.id) {
                      const params = new URLSearchParams(searchParams.toString())
                      // Preserve page, search, sort params when navigating to detail
                      const queryString = params.toString()
                      href = `${column.linkBasePath}/${row.id}${queryString ? `?returnPage=${currentPage}${search ? `&returnSearch=${encodeURIComponent(search)}` : ''}` : `?returnPage=${currentPage}`}`
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

      {paginate && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
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
              onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
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
