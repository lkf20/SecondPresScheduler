/** @jest-environment node */

const existsSyncMock = jest.fn()
const readdirSyncMock = jest.fn()
const executablePathMock = jest.fn()
const launchMock = jest.fn()
const homedirMock = jest.fn()

jest.mock('node:fs', () => ({
  __esModule: true,
  default: {
    existsSync: (...args: unknown[]) => existsSyncMock(...args),
    readdirSync: (...args: unknown[]) => readdirSyncMock(...args),
  },
}))

jest.mock('node:os', () => ({
  __esModule: true,
  default: {
    homedir: () => homedirMock(),
  },
}))

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    executablePath: () => executablePathMock(),
    launch: (...args: unknown[]) => launchMock(...args),
  },
}))

describe('puppeteer launch helpers', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    homedirMock.mockReturnValue('/home/test')
    executablePathMock.mockReturnValue('/mock/default-chrome')
    existsSyncMock.mockImplementation((candidate: string) => candidate === '/mock/default-chrome')
    readdirSyncMock.mockReturnValue([])
    delete process.env.PUPPETEER_EXECUTABLE_PATH
  })

  it('prefers PUPPETEER_EXECUTABLE_PATH when present', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/custom/chrome'
    existsSyncMock.mockImplementation((candidate: string) => candidate === '/custom/chrome')
    const { resolvePuppeteerExecutablePath } = await import('@/lib/reports/puppeteer-launch')

    expect(resolvePuppeteerExecutablePath()).toBe('/custom/chrome')
  })

  it('falls back to cache probing when executablePath is unavailable', async () => {
    executablePathMock.mockReturnValue('/missing/default')
    const linuxCandidate = '/home/test/.cache/puppeteer/chrome/linux-127/chrome-linux64/chrome'
    existsSyncMock.mockImplementation((candidate: string) => {
      if (candidate === '/home/test/.cache/puppeteer/chrome') return true
      return candidate === linuxCandidate
    })
    readdirSyncMock.mockReturnValue([{ isDirectory: () => true, name: 'linux-127' }])

    const { resolvePuppeteerExecutablePath } = await import('@/lib/reports/puppeteer-launch')

    expect(resolvePuppeteerExecutablePath()).toBe(linuxCandidate)
  })

  it('launchPdfBrowser passes executablePath and sandbox args', async () => {
    launchMock.mockResolvedValue({ ok: true })
    const { launchPdfBrowser } = await import('@/lib/reports/puppeteer-launch')

    await launchPdfBrowser()

    expect(launchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        executablePath: '/mock/default-chrome',
        args: expect.arrayContaining(['--no-sandbox', '--disable-setuid-sandbox']),
      })
    )
  })
})
