/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingExcludes: {
      '*': ['**/.cache/puppeteer/**'],
    },
  },
  outputFileTracingIncludes: {
    '/api/reports/daily-schedule/pdf': ['./node_modules/@sparticuz/chromium/**'],
    '/api/reports/sub-availability/pdf': ['./node_modules/@sparticuz/chromium/**'],
    '/api/reports/pdf-diagnostics': ['./node_modules/@sparticuz/chromium/**'],
  },
}

module.exports = nextConfig
