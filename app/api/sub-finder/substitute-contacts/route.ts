import { NextRequest, NextResponse } from 'next/server'
import {
  getOrCreateSubstituteContact,
  getSubstituteContact,
  updateSubstituteContact,
  upsertShiftOverrides,
} from '@/lib/api/substitute-contacts'
import { createErrorResponse } from '@/lib/utils/errors'

const shouldDebugLog =
  process.env.NODE_ENV === 'development' || process.env.SUB_FINDER_DEBUG === 'true'

const logSubstituteContactsError = (...args: unknown[]) => {
  if (shouldDebugLog) {
    console.error(...args)
  }
}

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
    logSubstituteContactsError('Error fetching substitute contact:', error)
    return createErrorResponse(
      error,
      'Failed to fetch substitute contact',
      500,
      'GET /api/sub-finder/substitute-contacts'
    )
  }
}

/**
 * PUT /api/sub-finder/substitute-contacts
 * Update a substitute contact
 * Body: { id, contact_status?, response_status?, is_contacted?, notes?, shift_overrides? }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      id,
      contact_status,
      response_status,
      is_contacted,
      notes,
      shift_overrides,
      selected_shift_keys,
    } = body

    if (!id) {
      return createErrorResponse('Missing required parameter: id', 400)
    }

    // Update contact
    const updates: {
      contact_status?:
        | 'not_contacted'
        | 'pending'
        | 'awaiting_response'
        | 'confirmed'
        | 'declined_all'
      response_status?: any
      is_contacted?: boolean
      notes?: string | null
    } = {}
    if (contact_status !== undefined) updates.contact_status = contact_status
    if (response_status !== undefined) updates.response_status = response_status
    if (is_contacted !== undefined) updates.is_contacted = is_contacted
    if (notes !== undefined) updates.notes = notes

    const updatedContact = await updateSubstituteContact(id, updates)

    // If decline_all and selected_shift_keys provided, enforce no selected shifts
    if (
      (contact_status === 'declined_all' || response_status === 'declined_all') &&
      Array.isArray(selected_shift_keys) &&
      selected_shift_keys.length > 0
    ) {
      return createErrorResponse('Cannot decline all while shifts are selected', 400)
    }

    // Update shift overrides if provided
    if (shift_overrides !== undefined && !Array.isArray(shift_overrides)) {
      return createErrorResponse('shift_overrides must be an array', 400)
    }

    if (Array.isArray(shift_overrides)) {
      try {
        await upsertShiftOverrides(id, shift_overrides)
      } catch (overrideError) {
        const details =
          overrideError instanceof Error ? overrideError.message : String(overrideError)
        logSubstituteContactsError('Error upserting shift overrides:', {
          contact_id: id,
          details,
        })
        return NextResponse.json(
          {
            error: 'Failed to upsert shift overrides',
            details,
          },
          { status: 500 }
        )
      }
    }

    // Fetch updated contact with details
    let contactWithDetails
    try {
      contactWithDetails = await getSubstituteContact(
        updatedContact.coverage_request_id,
        updatedContact.sub_id
      )
    } catch (fetchError) {
      logSubstituteContactsError('Error fetching contact with details:', fetchError)
      // Return the updated contact even if fetching details fails
      return NextResponse.json(updatedContact)
    }

    return NextResponse.json(contactWithDetails || updatedContact)
  } catch (error) {
    logSubstituteContactsError('Error updating substitute contact:', error)
    return createErrorResponse(
      error,
      'Failed to update substitute contact',
      500,
      'PUT /api/sub-finder/substitute-contacts'
    )
  }
}
