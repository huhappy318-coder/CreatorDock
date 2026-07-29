import { defineConfig } from '@playwright/test'

const baseURL = process.env.CREATORDOCK_BASE_URL ?? 'http://127.0.0.1:4174/CreatorDock/'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
})
