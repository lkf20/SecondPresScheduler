import { NextRequest, NextResponse } from 'next/server'
import {
  getOrCreateSubstituteContact,
  getSubstituteContact,
  updateSubstituteContact,
  upsertShiftOverrides,
} from '@/lib/api/substitute-contacts'
import { createErrorResponse, getErrorMessage } from '@/lib/utils/errors'

/**
 * GET /api/sub-finder/substitute-contacts
 * Get or create a substitute contact
 * Query params: coverage_request_id, sub_id
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const coverageRequestId = searchParams.get('coverage_request_id')
    const subId = searchParams.get('sub_id')

    if (!coverageRequestId || !subId) {
      return createErrorResponse('Missing required parameters: coverage_request_id and sub_id', 400)
    }

    const contact = await getOrCreateSubstituteContact(coverageRequestId, subId)
    const contactWithDetails = await getSubstituteContact(coverageRequestId, subId)

    return NextResponse.json(contactWithDetails || contact)
  } catch (error) {
    console.error('Error fetching substitute contact:', error)
    return createErrorResponse(error, 'Failed to fetch substitute contact', 500, 'GET /api/sub-finder/substitute-contacts')
  }
}

/**
 * PUT /api/sub-finder/substitute-contacts
 * Update a substitute contact
 * Body: { id, response_status?, is_contacted?, notes?, shift_overrides? }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, response_status, is_contacted, notes, shift_overrides } = body

    if (!id) {
      return createErrorResponse('Missing required parameter: id', 400)
    }

    // Update contact
    const updates: { response_status?: any; is_contacted?: boolean; notes?: string | null } = {}
    if (response_status !== undefined) updates.response_status = response_status
    if (is_contacted !== undefined) updates.is_contacted = is_contacted
    if (notes !== undefined) updates.notes = notes

    const updatedContact = await updateSubstituteContact(id, updates)

    // Update shift overrides if provided
    if (shift_overrides && Array.isArray(shift_overrides)) {
      await upsertShiftOverrides(id, shift_overrides)
    }

    // Fetch updated contact with details
    const contactWithDetails = await getSubstituteContact(
      updatedContact.coverage_request_id,
      updatedContact.sub_id
    )

    return NextResponse.json(contactWithDetails || updatedContact)
  } catch (error) {
    console.error('Error updating substitute contact:', error)
    return createErrorResponse(error, 'Failed to update substitute contact', 500, 'PUT /api/sub-finder/substitute-contacts')
  }
}

