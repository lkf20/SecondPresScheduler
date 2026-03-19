#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const puppeteerCacheDir = path.resolve(process.cwd(), '.cache', 'puppeteer')
const cacheRoots = [
  path.join(puppeteerCacheDir, 'chrome'),
  path.join(puppeteerCacheDir, 'chrome-headless-shell'),
]

const listVersionDirs = cacheRoot => {
  try {
    if (!fs.existsSync(cacheRoot)) return []
    return fs
      .readdirSync(cacheRoot, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
      .reverse()
  } catch {
    return []
  }
}

const executableCandidates = (cacheRoot, versionDir) => [
  path.join(cacheRoot, versionDir, 'chrome-linux64', 'chrome'),
  path.join(cacheRoot, versionDir, 'chrome-linux', 'chrome'),
  path.join(cacheRoot, versionDir, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
]

const findInstalledExecutable = () => {
  for (const cacheRoot of cacheRoots) {
    for (const versionDir of listVersionDirs(cacheRoot)) {
      const candidate = executableCandidates(cacheRoot, versionDir).find(filePath =>
        fs.existsSync(filePath)
      )
      if (candidate) return candidate
    }
  }
  return null
}

const shouldInstall = process.env.VERCEL === '1' || process.env.FORCE_PUPPETEER_INSTALL === '1'

if (!shouldInstall) {
  console.log('[puppeteer-install] skipping (not Vercel, set FORCE_PUPPETEER_INSTALL=1 to run)')
  process.exit(0)
}

const alreadyInstalled = findInstalledExecutable()
if (alreadyInstalled) {
  console.log(`[puppeteer-install] chrome already present at ${alreadyInstalled}`)
  process.exit(0)
}

console.log(
  `[puppeteer-install] installing chrome-headless-shell for testing into ${puppeteerCacheDir} ...`
)
const installResult = spawnSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['puppeteer', 'browsers', 'install', 'chrome-headless-shell', '--path', puppeteerCacheDir],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PUPPETEER_CACHE_DIR: puppeteerCacheDir,
    },
  }
)

if (installResult.status !== 0) {
  console.error('[puppeteer-install] install command failed')
  process.exit(installResult.status ?? 1)
}

const installedExecutable = findInstalledExecutable()
if (!installedExecutable) {
  console.error('[puppeteer-install] install completed but no executable was found')
  console.error(`[puppeteer-install] checked cache roots: ${cacheRoots.join(', ')}`)
  console.error(
    `[puppeteer-install] versions seen: ${cacheRoots
      .map(root => `${root}=[${listVersionDirs(root).join(', ') || '(none)'}]`)
      .join('; ')}`
  )
  process.exit(1)
}

console.log(`[puppeteer-install] installed chrome executable: ${installedExecutable}`)
