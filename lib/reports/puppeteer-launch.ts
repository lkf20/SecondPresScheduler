import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import puppeteer from 'puppeteer'

const PUPPETEER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']

const listVersionDirs = (cacheBase: string) => {
  try {
    if (!fs.existsSync(cacheBase)) return []
    return fs
      .readdirSync(cacheBase, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
      .reverse()
  } catch {
    return []
  }
}

const candidatesForVersion = (cacheBase: string, versionDir: string) => [
  // Linux (Vercel/serverless)
  path.join(cacheBase, versionDir, 'chrome-linux64', 'chrome'),
  path.join(cacheBase, versionDir, 'chrome-linux', 'chrome'),
  path.join(cacheBase, versionDir, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
  // macOS
  path.join(
    cacheBase,
    versionDir,
    'chrome-mac-arm64',
    'Google Chrome for Testing.app',
    'Contents',
    'MacOS',
    'Google Chrome for Testing'
  ),
  path.join(
    cacheBase,
    versionDir,
    'chrome-mac-x64',
    'Google Chrome for Testing.app',
    'Contents',
    'MacOS',
    'Google Chrome for Testing'
  ),
]

export const resolvePuppeteerExecutablePath = () => {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH
  if (envPath && fs.existsSync(envPath)) return envPath

  // Puppeteer-resolved path (works when browser is installed and traced correctly).
  try {
    const defaultPath = puppeteer.executablePath()
    if (defaultPath && fs.existsSync(defaultPath)) return defaultPath
  } catch {
    // Continue to manual cache probing below.
  }

  const cacheRoots = [
    // Prefer project-local cache for serverless tracing on Vercel.
    path.join(process.cwd(), '.cache', 'puppeteer', 'chrome'),
    // Fallback to user cache for local development.
    path.join(os.homedir(), '.cache', 'puppeteer', 'chrome'),
  ]

  for (const cacheBase of cacheRoots) {
    const versions = listVersionDirs(cacheBase)
    for (const versionDir of versions) {
      const match = candidatesForVersion(cacheBase, versionDir).find(candidate =>
        fs.existsSync(candidate)
      )
      if (match) return match
    }
  }

  return undefined
}

export const launchPdfBrowser = () => {
  const executablePath = resolvePuppeteerExecutablePath()
  return puppeteer.launch({
    args: PUPPETEER_ARGS,
    executablePath,
  })
}
