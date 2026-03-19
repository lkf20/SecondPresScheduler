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

const getCandidateExecutablePaths = () => {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH
  const cacheRoots = [
    path.join(process.cwd(), '.cache', 'puppeteer', 'chrome'),
    path.join(os.homedir(), '.cache', 'puppeteer', 'chrome'),
  ]

  const candidatePaths: string[] = []
  if (envPath) candidatePaths.push(envPath)

  for (const cacheBase of cacheRoots) {
    const versions = listVersionDirs(cacheBase)
    for (const versionDir of versions) {
      candidatePaths.push(...candidatesForVersion(cacheBase, versionDir))
    }
  }

  return {
    envPath,
    cacheRoots,
    candidatePaths,
  }
}

export const resolvePuppeteerExecutablePath = () => {
  const { envPath, cacheRoots } = getCandidateExecutablePaths()
  if (envPath && fs.existsSync(envPath)) return envPath

  // Puppeteer-resolved path (works when browser is installed and traced correctly).
  try {
    const defaultPath = puppeteer.executablePath()
    if (defaultPath && fs.existsSync(defaultPath)) return defaultPath
  } catch {
    // Continue to manual cache probing below.
  }

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

export const getPuppeteerLaunchDiagnostics = () => {
  const { envPath, cacheRoots, candidatePaths } = getCandidateExecutablePaths()

  let defaultExecutablePath: string | null = null
  let defaultExecutablePathError: string | null = null
  try {
    defaultExecutablePath = puppeteer.executablePath()
  } catch (error) {
    defaultExecutablePathError = error instanceof Error ? error.message : String(error)
  }

  const resolvedExecutablePath = resolvePuppeteerExecutablePath()

  return {
    runtime: {
      cwd: process.cwd(),
      homeDir: os.homedir(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
    env: {
      vercel: process.env.VERCEL === '1',
      nodeEnv: process.env.NODE_ENV || null,
      puppeteerExecutablePath: envPath || null,
      puppeteerSkipDownload: process.env.PUPPETEER_SKIP_DOWNLOAD || null,
      npmConfigIgnoreScripts: process.env.NPM_CONFIG_IGNORE_SCRIPTS || null,
    },
    puppeteer: {
      defaultExecutablePath,
      defaultExecutablePathExists: defaultExecutablePath
        ? fs.existsSync(defaultExecutablePath)
        : false,
      defaultExecutablePathError,
      resolvedExecutablePath: resolvedExecutablePath || null,
      resolvedExecutablePathExists: resolvedExecutablePath
        ? fs.existsSync(resolvedExecutablePath)
        : false,
    },
    cacheRoots: cacheRoots.map(cacheBase => ({
      path: cacheBase,
      exists: fs.existsSync(cacheBase),
      versions: listVersionDirs(cacheBase),
    })),
    candidates: candidatePaths.slice(0, 200).map(candidate => ({
      path: candidate,
      exists: fs.existsSync(candidate),
    })),
  }
}

export const launchPdfBrowser = () => {
  const executablePath = resolvePuppeteerExecutablePath()
  return puppeteer.launch({
    args: PUPPETEER_ARGS,
    executablePath,
  })
}
