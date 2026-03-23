// Root page — redirects to existing shirleyre.com static site
// The static HTML files (index.html, listings.html, etc.) are served
// by Cloudflare Pages as static assets alongside the Next.js output.
export default function Home() {
  return (
    <main style={{ display: 'none' }}>
      {/* Static site served by Cloudflare Pages static asset routing */}
    </main>
  )
}
