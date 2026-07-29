import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const distDirectory = resolve(process.cwd(), 'dist')
const expectedBasePath = process.env.CREATORDOCK_BASE_PATH ?? './'
const indexHtml = await readFile(resolve(distDirectory, 'index.html'), 'utf8')
const manifest = JSON.parse(await readFile(resolve(distDirectory, 'manifest.webmanifest'), 'utf8'))
const serviceWorker = await readFile(resolve(distDirectory, 'sw.js'), 'utf8')

const precacheUrls = [...serviceWorker.matchAll(/url:"([^"]+)"/g)].map((match) => match[1])
if (precacheUrls.length === 0) {
  throw new Error('No Workbox precache URLs were found in dist/sw.js.')
}
const duplicates = [...new Set(precacheUrls.filter((url, index) => precacheUrls.indexOf(url) !== index))]
if (duplicates.length > 0) {
  throw new Error(`Duplicate Workbox precache URLs: ${duplicates.join(', ')}`)
}

if (manifest.name !== 'CreatorDock' || manifest.start_url !== './' || manifest.scope !== './') {
  throw new Error('The generated manifest does not retain CreatorDock relative start_url and scope.')
}
if (!Array.isArray(manifest.icons) || manifest.icons.length === 0 || manifest.icons.some((icon) => /^[a-z][a-z\d+.-]*:/i.test(icon.src) || icon.src.startsWith('//'))) {
  throw new Error('Manifest icons must be non-empty local asset paths.')
}

const assetReferences = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((reference) => reference.includes('assets/'))
if (assetReferences.length === 0) {
  throw new Error('No local JavaScript or stylesheet assets were found in dist/index.html.')
}
if (expectedBasePath !== './' && assetReferences.some((reference) => !reference.startsWith(expectedBasePath))) {
  throw new Error(`Built asset paths do not use configured base path ${expectedBasePath}.`)
}
if (assetReferences.some((reference) => /^[a-z][a-z\d+.-]*:/i.test(reference) || reference.startsWith('//'))) {
  throw new Error('Built assets must remain local to the deployed origin.')
}

console.log(JSON.stringify({
  passed: true,
  expectedBasePath,
  precacheEntryCount: precacheUrls.length,
  duplicatePrecacheUrls: duplicates,
  manifestStartUrl: manifest.start_url,
  manifestScope: manifest.scope,
  manifestIconCount: manifest.icons.length,
  indexAssetReferences: assetReferences,
}, null, 2))
