const fs = require('fs')
const path = require('path')

function warroomBuild() {
  try {
    return fs.readFileSync(path.join(__dirname, 'public', 'warroom-build.txt'), 'utf8').trim()
  } catch {
    return ''
  }
}

/** @type {import('next').NextConfig} */
// cache-bust: 2026-04-22
const nextConfig = {
  // Cloudflare Pages compatibility
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    // Baked into the HTML. The page compares it to /warroom-build.txt.
    NEXT_PUBLIC_WARROOM_BUILD: warroomBuild(),
  },
  // Keep /warroom static files untouched
  // The V1 War Room at /warroom/index.html is served as a static file
  // via Cloudflare Pages — Next.js output goes to /out, CF Pages serves both
}

module.exports = nextConfig
