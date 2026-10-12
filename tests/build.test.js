import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve, dirname, basename} from 'node:path'
import {verifyBuild} from '../scripts/check-build.js'

function fixture() {
  const directory=mkdtempSync(join(tmpdir(),'cfsm-build-check-'))
  mkdirSync(join(directory,'assets'))
  writeFileSync(join(directory,'assets','index-new-hash.js'),'export {}')
  writeFileSync(join(directory,'assets','index-style.css'),'body {}')
  const html='<script src="./assets/index-new-hash.js"></script><link href="./assets/index-style.css" rel="stylesheet">'
  writeFileSync(join(directory,'index.html'),html)
  return {directory, html, cleanup() {
    const target=resolve(directory)
    assert.equal(dirname(target),resolve(tmpdir()))
    assert(basename(target).startsWith('cfsm-build-check-'))
    rmSync(target,{recursive:true,force:true})
  }}
}

test('Build validation accepts complete assets and ignores Git metadata only for deployment worktrees',()=>{
  const f=fixture()
  try {
    assert.equal(verifyBuild(f.directory).length,2)
    writeFileSync(join(f.directory,'.git'),'gitdir: example')
    assert.throws(()=>verifyBuild(f.directory),/Build root/)
    assert.equal(verifyBuild(f.directory,{allowGit:true}).length,2)
  } finally { f.cleanup() }
})

test('Build validation rejects a stale same-length entry script reference before publication',()=>{
  const f=fixture()
  try {
    const stale=f.html.replace('index-new-hash.js','index-old-hash.js')
    assert.equal(stale.length,f.html.length)
    writeFileSync(join(f.directory,'index.html'),stale)
    assert.throws(()=>verifyBuild(f.directory),/Missing referenced asset: .*index-old-hash.js/)
  } finally { f.cleanup() }
})

test('Build validation rejects missing stylesheets and resource paths outside assets',()=>{
  const f=fixture()
  try {
    writeFileSync(join(f.directory,'index.html'),f.html.replace('index-style.css','absent-file.css'))
    assert.throws(()=>verifyBuild(f.directory),/Missing referenced asset/)
    writeFileSync(join(f.directory,'index.html'),f.html.replace('./assets/index-new-hash.js','./assets/../index.html'))
    assert.throws(()=>verifyBuild(f.directory),/escapes assets/)
    writeFileSync(join(f.directory,'index.html'),f.html.replace('./assets/index-new-hash.js','/assets/index-new-hash.js'))
    assert.throws(()=>verifyBuild(f.directory),/relative assets URL/)
  } finally { f.cleanup() }
})
