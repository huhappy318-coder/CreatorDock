import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'allow' })

test('loads the CreatorDock app shell from its service worker while offline', async ({ page, context }) => {
  test.setTimeout(30_000)

  await page.goto('')
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker.ready
    return registration.active?.state === 'activated'
  })

  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)

  await context.setOffline(true)
  const response = await page.goto('')

  expect(response).not.toBeNull()
  expect(response?.fromServiceWorker()).toBe(true)
  await expect(page.getByRole('heading', { name: '分发工作台' })).toBeVisible()
  await expect(page.locator('.distribution-shell')).toBeVisible()
})
