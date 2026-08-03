import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'

const storageKey = 'creatordock.config'
const basePath = new URL(process.env.CREATORDOCK_BASE_URL ?? 'http://127.0.0.1:4174/CreatorDock/').pathname

type TestEntry = {
  id: string
  displayName: string
  destinationUrl: string
  browserTarget: 'default' | 'chrome' | 'edge'
  profileDirectoryName?: string
  createShortcut: boolean
  platformPresetId?: string
}

const entry = (overrides: Partial<TestEntry> = {}): TestEntry => ({
  id: 'entry-1',
  displayName: 'Studio account',
  destinationUrl: 'https://example.com/studio',
  browserTarget: 'default',
  createShortcut: false,
  ...overrides,
})

function config(entries: TestEntry[]) {
  return {
    schemaVersion: 2,
    entries,
    theme: 'system',
    density: 'comfortable',
    language: 'en',
  }
}

async function seed(page: Page, value: ReturnType<typeof config>) {
  await page.addInitScript(({ key, json }) => localStorage.setItem(key, json), {
    key: storageKey,
    json: JSON.stringify(value),
  })
}

async function addWeChatAccount(page: Page, label: string) {
  await page.getByRole('button', { name: /添加入口|Add destination/ }).first().click()
  const dialog = page.getByRole('dialog', { name: /添加入口|Add destination/ })
  await dialog.getByRole('combobox', { name: /平台|Platform/ }).fill('公众号')
  await dialog.getByRole('option', { name: /微信公众号|WeChat Official Accounts/ }).click()
  await dialog.getByLabel(/账号名称|Account label/).fill(label)
  await dialog.getByRole('button', { name: /保存入口|Save destination/ }).click()
}

async function openPreferences(page: Page) {
  await page.locator('details.compact-settings > summary').click()
}

test('loads under the configured base path and serves its manifest and local assets', async ({ page, request }) => {
  const response = await page.goto('')
  expect(response?.status()).toBe(200)
  expect(new URL(page.url()).pathname).toBe(basePath)
  await expect(page.getByRole('heading', { name: '创作者工作台' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'AI 写作', level: 2 })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'AI 写作助手', level: 2 })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /公众号·账号一/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /公众号·账号二/ })).toBeVisible()

  await openPreferences(page)
  const [defaultShortcutDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: '导出快捷方式文件' }).click(),
  ])
  const defaultShortcutPath = await defaultShortcutDownload.path()
  expect(defaultShortcutPath).toBeTruthy()
  const defaultShortcutExport = JSON.parse(await readFile(defaultShortcutPath!, 'utf8'))
  expect(defaultShortcutExport.shortcuts).toHaveLength(7)
  expect(defaultShortcutExport.shortcuts.map((shortcut: { displayName: string }) => shortcut.displayName)).toEqual([
    '小红书',
    '微信公众号',
    '哔哩哔哩',
    '抖音',
    'X / Twitter',
    '公众号·账号一',
    '公众号·账号二',
  ])
  expect(defaultShortcutExport.shortcuts.slice(5, 7)).toEqual([
    {
      displayName: '公众号·账号一',
      destinationUrl: 'https://mp.weixin.qq.com/',
      browserTarget: 'chrome',
      profileDirectoryName: 'Default',
      createShortcut: true,
    },
    {
      displayName: '公众号·账号二',
      destinationUrl: 'https://mp.weixin.qq.com/',
      browserTarget: 'edge',
      profileDirectoryName: 'Default',
      createShortcut: true,
    },
  ])

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

  const cardIconSrc = await page.locator('.card-link img').first().getAttribute('src')
  expect(cardIconSrc).toBeTruthy()
  const cardIconUrl = new URL(cardIconSrc!, page.url())
  expect(cardIconUrl.pathname.startsWith(basePath)).toBe(true)
  expect((await request.get(cardIconUrl.href)).status()).toBe(200)

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

test('keeps AI configuration off the home surface until settings is opened', async ({ page }) => {
  await page.goto('')
  await expect(page.getByRole('heading', { name: /模型与连接|Models and connection/ })).toHaveCount(0)
  await page.getByRole('button', { name: /模型设置|Model settings/ }).click()
  const dialog = page.getByRole('dialog', { name: /模型与连接|Models and connection/ })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: /写作风格与去 AI 味|Writing style and humanization/ })).toHaveCount(0)
  await expect(dialog.getByRole('heading', { name: /写作 Skill|Writing Skill/ })).toHaveCount(0)
  await page.getByRole('button', { name: /关闭模型设置|Close model settings/ }).click()
  await expect(dialog).toHaveCount(0)
})

test('keeps the workbench and writing area side by side at the desktop small-window size', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 620 })
  await page.goto('')

  const columns = await page.locator('.app-shell').evaluate((element) => getComputedStyle(element).gridTemplateColumns)
  expect(columns.split(' ')).toHaveLength(2)
  await expect(page.getByRole('button', { name: '写作风格与去 AI 味' })).toBeVisible()
  await expect(page.getByRole('button', { name: '写作 Skill' })).toBeVisible()
  await expect(page.getByRole('button', { name: '封面生成' })).toBeVisible()
})

test('opens the optional cover workspace without putting provider settings on the home surface', async ({ page }) => {
  await page.goto('')
  await page.getByRole('button', { name: '封面生成' }).click()
  await expect(page.getByRole('heading', { name: '封面生成', level: 2 })).toBeVisible()
  await expect(page.getByRole('button', { name: '模型设置' })).toHaveCount(0)
  await expect(page.getByLabel('负面提示词（可选）')).toBeVisible()
  await page.getByRole('button', { name: '封面设置' }).click()
  await expect(page.getByRole('dialog', { name: '封面接口与密钥' })).toBeVisible()
  await expect(page.getByText(/没有内置 Key/)).toBeVisible()
  await page.getByRole('button', { name: '关闭封面设置' }).click()
  await page.getByRole('button', { name: '回到写作' }).click()
  await expect(page.getByRole('button', { name: '模型设置' })).toBeVisible()
})

test('keeps duplicate accounts for one platform after a browser reload', async ({ page }) => {
  await page.goto('')
  await addWeChatAccount(page, '公众号账号一')
  await addWeChatAccount(page, '公众号账号二')

  await page.reload()

  await expect(page.getByRole('link', { name: /公众号账号一/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /公众号账号二/ })).toBeVisible()
  const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)
  expect(persisted.entries.filter((item: TestEntry) => item.platformPresetId === 'wechat-official-accounts')).toHaveLength(5)
})

test('searches and reorders visible destinations with the keyboard', async ({ page }) => {
  await seed(page, config([
    entry({ id: 'alpha', displayName: 'Alpha account', platformPresetId: 'wechat-official-accounts', destinationUrl: 'https://mp.weixin.qq.com/' }),
    entry({ id: 'beta', displayName: 'Beta account', platformPresetId: 'wechat-official-accounts', destinationUrl: 'https://mp.weixin.qq.com/' }),
    entry({ id: 'hidden', displayName: 'Video room', destinationUrl: 'https://example.com/video' }),
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

  await openPreferences(page)
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
  expect(full.entries[0]).toMatchObject({ id: 'profiled', profileDirectoryName: 'Default' })
  expect(full.entries[0]).not.toHaveProperty('group')
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
