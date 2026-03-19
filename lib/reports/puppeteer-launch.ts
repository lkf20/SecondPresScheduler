import fs from 'node:fs'
import os from 'node:os'
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

const EXTRA_PUPPETEER_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']

const getLaunchArgs = () => {
  const args = [...chromium.args, ...EXTRA_PUPPETEER_ARGS]
  return Array.from(new Set(args))
}

const envExecutablePath = () => process.env.PUPPETEER_EXECUTABLE_PATH || null

export const resolvePuppeteerExecutablePath = async () => {
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
      launchArgCount: getLaunchArgs().length,
    },
  }
}

export const launchPdfBrowser = async () => {
  const executablePath = await resolvePuppeteerExecutablePath()
  if (!executablePath) {
    throw new Error('Unable to resolve Chromium executable path for PDF generation.')
  }

  return puppeteer.launch({
    executablePath,
    args: getLaunchArgs(),
    headless: 'shell',
  })
}
