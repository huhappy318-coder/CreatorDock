import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { addModelProfile, createDefaultAiConfig } from '../src/aiConfig'
import { createDefaultConfig } from '../src/config'

async function setup(page: Page) {
  const ai = await addModelProfile(createDefaultAiConfig(), {
    name: '验收模型', provider: 'openai-compatible', baseUrl: 'https://api.example.test/v1',
    model: 'test-model', apiKey: 'fake-e2e-key', streaming: false, enabled: true,
  }, 'test-passphrase')
  const config = createDefaultConfig()
  config.entries = config.entries.slice(0, 2)
  await page.addInitScript(({ ai, config }) => {
    if (localStorage.getItem('e2e-seeded')) return
    localStorage.setItem('creatordock.config', JSON.stringify(config))
    localStorage.setItem('creatordock.ai.v1', JSON.stringify(ai))
    localStorage.setItem('e2e-seeded', 'yes')
  }, { ai, config })
  await page.goto('?view=assistant')
  await page.getByRole('button', { name: '模型设置', exact: true }).click()
  await page.getByLabel('本机解锁口令', { exact: true }).fill('test-passphrase')
  await page.getByRole('button', { name: '关闭模型设置' }).click()
}

test('generates isolated variants, retries failures, edits, exports and restores package history', async ({ page }) => {
  let requests = 0
  await page.route('https://api.example.test/**', async (route) => {
    requests += 1
    if (requests === 2) { await route.fulfill({ status: 429, body: 'Quota temporarily unavailable' }); return }
    await route.fulfill({ json: { choices: [{ message: { content: `平台成稿 ${requests}` } }] } })
  })
  await setup(page)
  await page.getByLabel('写作任务', { exact: true }).fill('独立创作者如何整理灵感')
  await page.getByRole('button', { name: '生成内容包', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('1/2')
  await expect(page.getByText('Provider returned HTTP 429.')).toBeVisible()
  await page.getByRole('button', { name: '重试未完成稿件' }).click()
  await expect(page.getByRole('status')).toContainText('2/2')
  expect(requests).toBe(3)
  const editors = page.locator('.content-variant-editor')
  await expect(editors.first()).toHaveValue('平台成稿 1')
  await editors.first().fill('编辑后的终稿：保留我的观点。')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '导出内容包' }).click()
  const download = await downloadPromise
  const exported = await readFile((await download.path())!, 'utf8')
  expect(exported).toContain('编辑后的终稿：保留我的观点。')
  expect(exported).toContain('平台成稿 3')
  expect(exported).not.toContain('fake-e2e-key')
  await page.getByLabel('写作任务', { exact: true }).fill('第二个选题')
  await page.getByRole('button', { name: '生成内容包', exact: true }).click()
  await expect(editors.first()).toHaveValue('平台成稿 4')
  await expect(page.getByRole('button', { name: '生成内容包', exact: true })).toBeEnabled()
  await page.reload()
  const history = page.getByLabel('历史内容包', { exact: true })
  await expect(history.locator('option')).toHaveCount(2)
  const oldId = await history.locator('option').last().getAttribute('value')
  await history.selectOption(oldId!)
  await expect(editors.first()).toHaveValue('编辑后的终稿：保留我的观点。')
  await page.screenshot({ path: 'test-results/content-package-desktop.png', fullPage: true })
})

test('stops a pending package and keeps it recoverable after reload', async ({ page }) => {
  let requested = false
  await page.route('https://api.example.test/**', async () => { requested = true })
  await setup(page)
  await page.getByLabel('写作任务', { exact: true }).fill('测试停止生成')
  await page.getByRole('button', { name: '生成内容包', exact: true }).click()
  await expect.poll(() => requested).toBe(true)
  await page.getByRole('button', { name: '停止生成' }).click()
  await expect(page.getByRole('status')).toContainText('已停止生成')
  await expect(page.getByRole('button', { name: '生成内容包', exact: true })).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('button', { name: '重试未完成稿件' })).toBeVisible()
  await expect(page.locator('.content-package-variant.interrupted')).toHaveCount(2)
})

test('mobile writing navigation reaches the editor with no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('')
  await page.getByRole('button', { name: 'AI 辅助适配', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'AI 写作', exact: true })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/content-package-mobile.png', fullPage: true })
})
