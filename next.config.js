/** @type {import('next').NextConfig} */
// cache-bust: 2026-04-22
const nextConfig = {
  // Cloudflare Pages compatibility
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  // Keep /warroom static files untouched
  // The V1 War Room at /warroom/index.html is served as a static file
  // via Cloudflare Pages — Next.js output goes to /out, CF Pages serves both
}

module.exports = nextConfig
