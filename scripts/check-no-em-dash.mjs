import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = process.cwd()
const excluded = new Set(['.git', 'node_modules'])
const binaryExtensions = new Set(['.woff2', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.avif', '.pdf', '.zip'])
const failures = []

async function scan(path) {
  const info = await stat(path)
  if (info.isDirectory()) {
    if (excluded.has(path.split('/').pop())) return
    for (const entry of await readdir(path)) await scan(join(path, entry))
    return
  }
  const extension = path.slice(path.lastIndexOf('.')).toLowerCase()
  if (binaryExtensions.has(extension)) return
  const buffer = await readFile(path)
  if (buffer.includes(0)) return
  const content = buffer.toString('utf8')
  if (content.includes('\u2014')) failures.push(relative(root, path))
}

await scan(root)
if (failures.length) {
  console.error(`Forbidden U+2014 found in:\n${failures.join('\n')}`)
  process.exit(1)
}
console.log('Text check passed: no U+2014 characters found.')
