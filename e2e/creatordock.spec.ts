import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const storageKey = 'creatordock.config'
const basePath = new URL(process.env.CREATORDOCK_BASE_URL ?? 'http://127.0.0.1:4174/CreatorDock/').pathname

type TestEntry = {
  id: string
  displayName: string
  destinationUrl: string
  group: string
  browserTarget: 'default' | 'chrome' | 'edge'
  profileDirectoryName?: string
  createShortcut: boolean
  platformPresetId?: string
}

const entry = (overrides: Partial<TestEntry> = {}): TestEntry => ({
  id: 'entry-1',
  displayName: 'Studio account',
  destinationUrl: 'https://example.com/studio',
  group: 'Work',
  browserTarget: 'default',
  createShortcut: false,
  ...overrides,
})

function config(entries: TestEntry[]) {
  return {
    schemaVersion: 1,
    entries,
    theme: 'system',
    density: 'comfortable',
  }
}

async function seed(page: Page, value: ReturnType<typeof config>) {
  await page.addInitScript(({ key, json }) => localStorage.setItem(key, json), {
    key: storageKey,
    json: JSON.stringify(value),
  })
}

async function addWeChatAccount(page: Page, label: string) {
  await page.getByRole('button', { name: 'Add destination' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Add destination' })
  await dialog.getByLabel('Platform').selectOption('wechat-official-accounts')
  await dialog.getByLabel('Account label').fill(label)
  await dialog.getByRole('button', { name: 'Save destination' }).click()
}

test('loads under the configured base path and serves its manifest and local assets', async ({ page, request }) => {
  const response = await page.goto('')
  expect(response?.status()).toBe(200)
  expect(new URL(page.url()).pathname).toBe(basePath)
  await expect(page.getByRole('heading', { name: 'Begin where your work lives.' })).toBeVisible()

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(manifestHref).toBeTruthy()
  const manifestUrl = new URL(manifestHref!, page.url())
  expect(manifestUrl.origin).toBe(new URL(page.url()).origin)
  expect(manifestUrl.pathname.startsWith(basePath)).toBe(true)

  const manifestResponse = await request.get(manifestUrl.href)
  expect(manifestResponse.status()).toBe(200)
  const manifest = await manifestResponse.json()
  expect(manifest).toMatchObject({ name: 'CreatorDock', start_url: './', scope: './' })
  expect(manifest.icons.length).toBeGreaterThan(0)

  for (const icon of manifest.icons) {
    const iconUrl = new URL(icon.src, manifestUrl)
    expect(iconUrl.origin).toBe(manifestUrl.origin)
    expect(iconUrl.pathname.startsWith(basePath)).toBe(true)
    expect((await request.get(iconUrl.href)).status()).toBe(200)
  }

  const assetReferences = await page.locator('script[src], link[rel="stylesheet"][href]').evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('src') ?? element.getAttribute('href')).filter(Boolean) as string[],
  )
  expect(assetReferences.length).toBeGreaterThan(0)
  for (const reference of assetReferences) {
    const assetUrl = new URL(reference, page.url())
    expect(assetUrl.origin).toBe(manifestUrl.origin)
    expect(assetUrl.pathname.startsWith(basePath)).toBe(true)
    expect((await request.get(assetUrl.href)).status()).toBe(200)
  }
})

test('keeps duplicate accounts for one platform after a browser reload', async ({ page }) => {
  await page.goto('')
  await addWeChatAccount(page, '公众号账号一')
  await addWeChatAccount(page, '公众号账号二')

  await page.reload()

  await expect(page.getByRole('link', { name: /公众号账号一/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /公众号账号二/ })).toBeVisible()
  const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)
  expect(persisted.entries.filter((item: TestEntry) => item.platformPresetId === 'wechat-official-accounts')).toHaveLength(3)
})

test('searches and reorders visible destinations with the keyboard', async ({ page }) => {
  await seed(page, config([
    entry({ id: 'alpha', displayName: 'Alpha account', platformPresetId: 'wechat-official-accounts', destinationUrl: 'https://mp.weixin.qq.com/' }),
    entry({ id: 'beta', displayName: 'Beta account', platformPresetId: 'wechat-official-accounts', destinationUrl: 'https://mp.weixin.qq.com/' }),
    entry({ id: 'hidden', displayName: 'Video room', destinationUrl: 'https://example.com/video', group: 'Video' }),
  ]))
  await page.goto('')

  await page.getByRole('searchbox', { name: 'Search destinations' }).fill('WeChat Official Accounts')
  await expect(page.getByRole('link', { name: /Video room/ })).toHaveCount(0)
  const moveEarlier = page.getByRole('button', { name: 'Move Beta account earlier' })
  await moveEarlier.focus()
  await page.keyboard.press('Enter')

  await expect(page.locator('.card-link strong')).toHaveText(['Beta account', 'Alpha account'])
})

test('retains the current configuration after an invalid import', async ({ page }) => {
  const current = config([entry({ displayName: 'Current account' })])
  await seed(page, current)
  await page.goto('')

  await page.getByLabel('Import configuration').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"schemaVersion":1,"theme":"system","density":"comfortable","entries":[{"id":"bad","displayName":"Bad","destinationUrl":"file:///unsafe","group":"Work"}]}'),
  })

  await expect(page.getByRole('alert')).toContainText(/HTTP\(S\)|destination URL/i)
  await expect(page.getByRole('link', { name: /Current account/ })).toBeVisible()
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual(current)
})

test('downloads non-empty and structurally distinct full and shortcut-only exports', async ({ page }) => {
  await seed(page, config([
    entry({
      id: 'profiled',
      displayName: 'Profiled account',
      browserTarget: 'chrome',
      profileDirectoryName: 'Default',
      createShortcut: true,
    }),
    entry({
      id: 'secondary',
      displayName: 'Secondary account',
      destinationUrl: 'https://example.com/secondary',
      browserTarget: 'edge',
      profileDirectoryName: 'Default',
    }),
  ]))
  await page.goto('')

  const [fullDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export configuration' }).click(),
  ])
  const [shortcutDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export shortcut file' }).click(),
  ])
  expect(fullDownload.suggestedFilename()).toBe('creatordock-config.json')
  expect(shortcutDownload.suggestedFilename()).toBe('creatordock-shortcuts.json')

  const fullPath = await fullDownload.path()
  const shortcutPath = await shortcutDownload.path()
  expect(fullPath).toBeTruthy()
  expect(shortcutPath).toBeTruthy()
  const fullText = await readFile(fullPath!, 'utf8')
  const shortcutText = await readFile(shortcutPath!, 'utf8')
  const full = JSON.parse(fullText)
  const shortcutOnly = JSON.parse(shortcutText)

  expect(full.entries).toHaveLength(2)
  expect(full.entries[0]).toMatchObject({ id: 'profiled', group: 'Work', profileDirectoryName: 'Default' })
  expect(shortcutOnly.shortcuts).toHaveLength(2)
  expect(shortcutOnly.shortcuts[0]).toEqual({
    displayName: 'Profiled account',
    destinationUrl: 'https://example.com/studio',
    browserTarget: 'chrome',
    profileDirectoryName: 'Default',
    createShortcut: true,
  })
  expect(fullText.length).toBeGreaterThan(0)
  expect(shortcutText.length).toBeGreaterThan(0)
  expect(shortcutOnly).not.toEqual(full)
  expect(shortcutText).not.toBe(fullText)
})
