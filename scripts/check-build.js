import {readdirSync, readFileSync} from 'node:fs'
import assert from 'node:assert/strict'
assert.deepEqual(readdirSync('dist').sort(), ['assets','index.html'])
const html=readFileSync('dist/index.html','utf8')
assert(!/\b(?:src|href)="\/assets\//.test(html))
assert(/\.\/assets\//.test(html))
console.log('Build structure and relative asset references verified.')
