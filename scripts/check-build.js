import {readdirSync, readFileSync, statSync} from 'node:fs'
import {resolve, relative, isAbsolute} from 'node:path'
import {pathToFileURL} from 'node:url'
import assert from 'node:assert/strict'

export function verifyBuild(directory='dist', {allowGit=false}={}) {
  const root=resolve(directory)
  const entries=readdirSync(root).filter(name=>!allowGit || name!=='.git').sort()
  assert.deepEqual(entries, ['assets','index.html'], 'Build root must contain only index.html and assets/')
  assert(statSync(resolve(root,'assets')).isDirectory(), 'assets must be a directory')
  assert(statSync(resolve(root,'index.html')).isFile(), 'index.html must be a file')
  const html=readFileSync(resolve(root,'index.html'),'utf8')
  const references=[...html.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(match=>match[1])
  assert(references.length>0, 'No entry resources found')
  for (const reference of references) {
    assert(reference.startsWith('./assets/'), `Resource must use a relative assets URL: ${reference}`)
    const target=resolve(root,decodeURIComponent(reference.split(/[?#]/)[0]))
    const inside=relative(resolve(root,'assets'),target)
    assert(inside && !inside.startsWith('..') && !isAbsolute(inside), `Resource escapes assets/: ${reference}`)
    let exists=false
    try { exists=statSync(target).isFile() } catch {}
    assert(exists, `Missing referenced asset: ${reference}`)
  }
  return references
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  verifyBuild(process.argv[2] || 'dist', {allowGit:!!process.argv[2]})
  console.log('Build structure, relative URLs and referenced resource files verified.')
}
