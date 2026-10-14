const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

function buildId() {
  const fromEnv = process.env.CF_PAGES_COMMIT_SHA
    || process.env.WORKERS_CI_COMMIT_SHA
    || process.env.GITHUB_SHA
    || ''
  if (fromEnv.trim()) return fromEnv.trim()
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return String(Date.now())
  }
}

const id = buildId()
const dest = path.join(__dirname, '..', 'public', 'warroom-build.txt')
fs.writeFileSync(dest, id + '\n')
console.log('warroom-build', id)
