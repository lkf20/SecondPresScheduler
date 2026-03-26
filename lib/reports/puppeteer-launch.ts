import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'
import type { LaunchOptions } from 'puppeteer-core'

const EXTRA_PUPPETEER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']
const LOCAL_PUPPETEER_ARGS = [
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-dev-shm-usage',
  '--font-render-hinting=none',
  '--remote-debugging-port=0',
]
const LOCAL_PUPPETEER_FALLBACK_ARGS = ['--disable-gpu', '--disable-software-rasterizer']
const LOCAL_LAUNCH_ATTEMPT_TIMEOUT_MS = 25000

const getServerlessLaunchArgs = () => {
  const args = [...chromium.args, ...EXTRA_PUPPETEER_ARGS]
  return Array.from(new Set(args))
}

const envExecutablePath = () => process.env.PUPPETEER_EXECUTABLE_PATH || null

const isServerlessRuntime = () =>
  process.env.VERCEL === '1' ||
  Boolean(process.env.AWS_EXECUTION_ENV) ||
  Boolean(process.env.LAMBDA_TASK_ROOT)

const prefersShellHeadless = (executablePath: string) => {
  const normalized = executablePath.toLowerCase()
  return normalized.includes('chrome-headless-shell') || normalized.endsWith('/chromium')
}

export const resolvePuppeteerExecutablePath = async () => {
  if (!isServerlessRuntime()) {
    const localEnvPath = envExecutablePath()
    if (localEnvPath && fs.existsSync(localEnvPath)) {
      return localEnvPath
    }
    return undefined
  }

  const fromEnv = envExecutablePath()
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv
  }

  const fromChromium = await chromium.executablePath()
  if (fromChromium && fs.existsSync(fromChromium)) {
    return fromChromium
  }

  return undefined
}

export const getPuppeteerLaunchDiagnostics = async () => {
  const configuredExecutablePath = envExecutablePath()
  const chromiumExecutablePath = await chromium.executablePath()
  const resolvedExecutablePath = await resolvePuppeteerExecutablePath()

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
      serverlessRuntime: isServerlessRuntime(),
      nodeEnv: process.env.NODE_ENV || null,
      puppeteerExecutablePath: configuredExecutablePath,
      chromiumPath: process.env.CHROMIUM_PATH || null,
    },
    puppeteer: {
      configuredExecutablePath,
      configuredExecutablePathExists: configuredExecutablePath
        ? fs.existsSync(configuredExecutablePath)
        : false,
      chromiumExecutablePath: chromiumExecutablePath || null,
      chromiumExecutablePathExists: chromiumExecutablePath
        ? fs.existsSync(chromiumExecutablePath)
        : false,
      resolvedExecutablePath: resolvedExecutablePath || null,
      resolvedExecutablePathExists: resolvedExecutablePath
        ? fs.existsSync(resolvedExecutablePath)
        : false,
      launchArgCount: isServerlessRuntime()
        ? getServerlessLaunchArgs().length
        : LOCAL_PUPPETEER_ARGS.length,
      launchMode: isServerlessRuntime() ? 'serverless' : 'local',
    },
  }
}

export const launchPdfBrowser = async () => {
  const executablePath = await resolvePuppeteerExecutablePath()
  if (!executablePath) {
    if (isServerlessRuntime()) {
      throw new Error('Unable to resolve Chromium executable path for PDF generation.')
    }
    throw new Error(
      'Local Chrome path missing or invalid. Set PUPPETEER_EXECUTABLE_PATH to a valid Chrome executable.'
    )
  }

  if (isServerlessRuntime()) {
    return puppeteer.launch({
      executablePath,
      args: getServerlessLaunchArgs(),
      headless: prefersShellHeadless(executablePath) ? 'shell' : true,
      timeout: 120000,
      protocolTimeout: 120000,
    })
  }

  const dumpio = process.env.PDF_DEBUG === '1'
  const localBase: LaunchOptions = {
    executablePath,
    headless: true,
    timeout: 45000,
    protocolTimeout: 45000,
    dumpio,
    pipe: false,
  }

  const localAttempts: LaunchOptions[] = [
    {
      ...localBase,
      args: LOCAL_PUPPETEER_ARGS,
      userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-chrome-profile-')),
    },
    {
      ...localBase,
      args: [...LOCAL_PUPPETEER_ARGS, ...LOCAL_PUPPETEER_FALLBACK_ARGS],
    },
    {
      ...localBase,
      args: [],
    },
  ]

  const failures: string[] = []
  const launchWithTimeout = async (attempt: LaunchOptions, attemptNumber: number) => {
    return Promise.race([
      puppeteer.launch(attempt),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `attempt ${attemptNumber} launch timed out after ${LOCAL_LAUNCH_ATTEMPT_TIMEOUT_MS}ms`
              )
            ),
          LOCAL_LAUNCH_ATTEMPT_TIMEOUT_MS
        )
      ),
    ])
  }

  for (let index = 0; index < localAttempts.length; index += 1) {
    const attempt = localAttempts[index]
    try {
      return await launchWithTimeout(attempt, index + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`attempt ${index + 1}: ${message}`)
    }
  }

  throw new Error(`Failed to launch local Chrome for PDF generation (${failures.join(' | ')})`)
}
