#!/usr/bin/env node
/**
 * Test script to verify school_id migration
 * Run with: node scripts/test-school-id-migration.js
 */

const fs = require('fs')
const path = require('path')

// Simple .env.local parser
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8')
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim().replace(/^["']|["']$/g, '')
        process.env[key] = value
      }
    })
  }
}

loadEnv()

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
// Try service role key first, fall back to publishable key
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error(
    '   SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:',
    supabaseKey ? '✓' : '✗'
  )
  console.error(
    '\nNote: Using publishable key may have RLS restrictions. Service role key is preferred for testing.'
  )
  if (!supabaseKey) process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '⚠️  Warning: Using publishable key instead of service role key. Some tests may fail due to RLS policies.\n'
  )
}

const results = []

async function testColumnExists(table, column) {
  try {
    const { data, error } = await supabase.from(table).select(column).limit(1)

    if (error) {
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        return false
      }
      throw error
    }
    return true
  } catch (error) {
    if (error.message?.includes('column') && error.message?.includes('does not exist')) {
      return false
    }
    throw error
  }
}

async function testColumnNotNull(table, column) {
  try {
    const { data, error } = await supabase.from(table).select(column).is(column, null).limit(1)

    if (error) throw error
    return !data || data.length === 0
  } catch (error) {
    throw error
  }
}

async function testTableHasData(table) {
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
    } catch (error) {
      results.push({
        name: `${table}.school_id column exists`,
        passed: false,
        message: `✗ Error: ${error.message}`,
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
    } catch (error) {
      results.push({
        name: `${table}.school_id is NOT NULL`,
        passed: false,
        message: `✗ Error: ${error.message}`,
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
    } catch (error) {
      results.push({
        name: `${table} has data`,
        passed: false,
        message: `✗ Error: ${error.message}`,
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
    } catch (error) {
      results.push({
        name: `${table} uses default school_id`,
        passed: false,
        message: `✗ Error: ${error.message}`,
      })
    }
  }

  // Test 5: Check profiles table
  console.log('📋 Test 5: Checking profiles table...')
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
  } catch (error) {
    results.push({
      name: 'profiles table check',
      passed: false,
      message: `✗ Error: ${error.message}`,
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
    console.log(`${icon} ${result.name}`)
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
