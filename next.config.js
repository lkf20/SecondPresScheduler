/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/api/reports/daily-schedule/pdf': ['./.cache/puppeteer/**'],
    '/api/reports/sub-availability/pdf': ['./.cache/puppeteer/**'],
  },
}

module.exports = nextConfig
