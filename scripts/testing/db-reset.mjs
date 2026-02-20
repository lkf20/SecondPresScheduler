#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const run = args =>
  spawnSync('supabase', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

console.log('Resetting local Supabase test DB (migrations only)...')
const result = run(['db', 'reset', '--local', '--no-seed'])

if (result.status !== 0) {
  console.error('Failed to reset local test DB. Ensure Supabase local stack is running.')
  process.exit(result.status ?? 1)
}

console.log('Local test DB reset complete.')
