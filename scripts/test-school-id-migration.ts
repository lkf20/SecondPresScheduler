#!/usr/bin/env tsx
/**
 * Test script to verify school_id migration and RLS policies
 * Run with: npx tsx scripts/test-school-id-migration.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

interface TestResult {
  name: string
  passed: boolean
  message: string
  details?: unknown
}

const results: TestResult[] = []

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

async function testColumnExists(table: string, column: string): Promise<boolean> {
  try {
    const { error } = await supabase.from(table).select(column).limit(1)

    if (error) {
      // If column doesn't exist, we'll get a specific error
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        return false
      }
      throw error
    }
    return true
  } catch (error: unknown) {
    const message = getErrorMessage(error)
    if (message.includes('column') && message.includes('does not exist')) {
      return false
    }
    throw error
  }
}

async function testColumnNotNull(table: string, column: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from(table).select(column).is(column, null).limit(1)

    if (error) throw error
    // If we get results, there are NULL values
    return !data || data.length === 0
  } catch (error) {
    throw error
  }
}

async function testTableHasData(table: string): Promise<number> {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })

    if (error) throw error
    return count || 0
  } catch (error) {
    throw error
  }
}

async function runTests() {
  console.log('🧪 Starting school_id migration tests...\n')

  // Tables that should have school_id
  const tablesWithSchoolId = [
    'classrooms',
    'time_slots',
    'class_groups',
    'teacher_schedules',
    'staffing_rules',
    'schedule_cells',
    'schedule_settings',
  ]

  // Test 1: Check school_id columns exist
  console.log('📋 Test 1: Checking school_id columns exist...')
  for (const table of tablesWithSchoolId) {
    try {
      const exists = await testColumnExists(table, 'school_id')
      results.push({
        name: `${table}.school_id column exists`,
        passed: exists,
        message: exists ? `✓ Column exists` : `✗ Column missing`,
      })
    } catch (error: unknown) {
      results.push({
        name: `${table}.school_id column exists`,
        passed: false,
        message: `✗ Error: ${getErrorMessage(error)}`,
      })
    }
  }

  // Test 2: Check school_id columns are NOT NULL
  console.log('📋 Test 2: Checking school_id columns are NOT NULL...')
  for (const table of tablesWithSchoolId) {
    try {
      const isNotNull = await testColumnNotNull(table, 'school_id')
      results.push({
        name: `${table}.school_id is NOT NULL`,
        passed: isNotNull,
        message: isNotNull ? `✓ No NULL values` : `✗ Has NULL values`,
      })
    } catch (error: unknown) {
      results.push({
        name: `${table}.school_id is NOT NULL`,
        passed: false,
        message: `✗ Error: ${getErrorMessage(error)}`,
      })
    }
  }

  // Test 3: Check data exists in tables
  console.log('📋 Test 3: Checking table data...')
  for (const table of tablesWithSchoolId) {
    try {
      const count = await testTableHasData(table)
      results.push({
        name: `${table} has data`,
        passed: count > 0,
        message: count > 0 ? `✓ ${count} rows` : `✗ No data`,
        details: { count },
      })
    } catch (error: unknown) {
      results.push({
        name: `${table} has data`,
        passed: false,
        message: `✗ Error: ${getErrorMessage(error)}`,
      })
    }
  }

  // Test 4: Check for default school_id value
  console.log('📋 Test 4: Checking default school_id value...')
  const defaultSchoolId = '00000000-0000-0000-0000-000000000001'
  for (const table of tablesWithSchoolId) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('school_id', defaultSchoolId)

      if (error) throw error

      const totalCount = await testTableHasData(table)
      const allHaveDefault = totalCount === (count || 0)

      results.push({
        name: `${table} uses default school_id`,
        passed: allHaveDefault,
        message: allHaveDefault
          ? `✓ All ${count} rows use default school_id`
          : `✗ Only ${count}/${totalCount} rows use default school_id`,
        details: { defaultCount: count, totalCount },
      })
    } catch (error: unknown) {
      results.push({
        name: `${table} uses default school_id`,
        passed: false,
        message: `✗ Error: ${getErrorMessage(error)}`,
      })
    }
  }

  // Test 5: Check unique constraints include school_id
  console.log('📋 Test 5: Checking unique constraints...')
  const uniqueConstraintTests = [
    { table: 'classrooms', columns: ['name', 'school_id'] },
    { table: 'time_slots', columns: ['code', 'school_id'] },
    { table: 'class_groups', columns: ['name', 'school_id'] },
  ]

  for (const test of uniqueConstraintTests) {
    try {
      // Try to insert duplicate to test constraint
      // First, get an existing row
      const { data: existing, error: fetchError } = await supabase
        .from(test.table)
        .select(test.columns.join(', '))
        .limit(1)

      if (fetchError || !existing || existing.length === 0) {
        results.push({
          name: `${test.table} unique constraint (${test.columns.join(', ')})`,
          passed: false,
          message: `✗ Cannot test - no existing data`,
        })
        continue
      }

      const existingRow = existing[0]
      const duplicateValues: Record<string, unknown> = {}
      test.columns.forEach(col => {
        duplicateValues[col] = existingRow[col]
      })

      // Try to insert duplicate (should fail)
      const { error: insertError } = await supabase.from(test.table).insert(duplicateValues)

      // If insert fails with unique constraint error, constraint exists
      const constraintExists =
        insertError?.message?.includes('unique') || insertError?.code === '23505'

      results.push({
        name: `${test.table} unique constraint (${test.columns.join(', ')})`,
        passed: constraintExists,
        message: constraintExists
          ? `✓ Unique constraint exists`
          : `✗ Unique constraint missing or error: ${insertError?.message}`,
      })
    } catch (error: unknown) {
      results.push({
        name: `${test.table} unique constraint`,
        passed: false,
        message: `✗ Error: ${getErrorMessage(error)}`,
      })
    }
  }

  // Test 6: Verify profiles table has school_id
  console.log('📋 Test 6: Checking profiles table...')
  try {
    const hasSchoolId = await testColumnExists('profiles', 'school_id')
    results.push({
      name: 'profiles.school_id column exists',
      passed: hasSchoolId,
      message: hasSchoolId ? `✓ Column exists` : `✗ Column missing`,
    })

    if (hasSchoolId) {
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('school_id', 'is', null)

      if (!error && count !== null) {
        results.push({
          name: 'profiles have school_id',
          passed: count > 0,
          message:
            count > 0 ? `✓ ${count} profiles have school_id` : `✗ No profiles have school_id`,
        })
      }
    }
  } catch (error: unknown) {
    results.push({
      name: 'profiles table check',
      passed: false,
      message: `✗ Error: ${getErrorMessage(error)}`,
    })
  }

  // Print results
  console.log('\n' + '='.repeat(60))
  console.log('📊 Test Results Summary')
  console.log('='.repeat(60) + '\n')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  results.forEach(result => {
    const icon = result.passed ? '✓' : '✗'
    const color = result.passed ? '\x1b[32m' : '\x1b[31m'
    const reset = '\x1b[0m'
    console.log(`${color}${icon}${reset} ${result.name}`)
    console.log(`   ${result.message}`)
    if (result.details) {
      console.log(`   Details:`, result.details)
    }
    console.log()
  })

  console.log('='.repeat(60))
  console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`)
  console.log('='.repeat(60) + '\n')

  if (failed > 0) {
    console.log('❌ Some tests failed. Please review the results above.')
    process.exit(1)
  } else {
    console.log('✅ All tests passed!')
    process.exit(0)
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Fatal error running tests:', error)
  process.exit(1)
})
