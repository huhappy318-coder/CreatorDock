import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Several tests deliberately execute PBKDF2 + AES-GCM. Running every file
    // in parallel can make those real crypto assertions exceed Vitest's default
    // timeout on shared CI runners; serial files keep the assertions intact.
    fileParallelism: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
