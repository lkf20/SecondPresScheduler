#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const seedFile = resolve(process.cwd(), 'supabase/seed.test.sql')

if (!existsSync(seedFile)) {
  console.error(`Missing seed file: ${seedFile}`)
  process.exit(1)
}

const result = spawnSync('supabase', ['db', 'execute', '--local', '--file', seedFile], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

if (result.status !== 0) {
  console.error('Failed to seed local test DB.')
  process.exit(result.status ?? 1)
}

console.log('Local test DB seeded successfully.')
