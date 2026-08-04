import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'allow' })

test('loads the CreatorDock app shell from its service worker while offline', async ({ page, context }) => {
  test.setTimeout(30_000)

  await page.goto('')
  await page.waitForFunction(async () => {
    await navigator.serviceWorker.ready
    return true
  })

  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  await context.setOffline(true)
  const response = await page.goto('')

  expect(response).not.toBeNull()
  expect(response?.fromServiceWorker()).toBe(true)
  await expect(page.locator('#workbench')).toBeVisible()
  await expect(page.locator('.app-shell')).toBeVisible()
})
