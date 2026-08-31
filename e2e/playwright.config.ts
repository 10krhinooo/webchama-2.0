import { defineConfig, devices } from '@playwright/test'
import { BASE_URL } from './support/env'

export default defineConfig({
  testDir: './specs',
  globalSetup: './support/global-setup.ts',

  // Each mutating spec owns its own chama in the fixture, so nothing is shared and the database
  // never needs resetting between files. Parallelism is still capped in CI: the suite drives one
  // backend and one Keycloak, and a runner that oversubscribes them produces timeouts that look
  // like product failures.
  fullyParallel: false,
  // One worker everywhere, not just in CI. The suite drives a single backend and a single
  // Keycloak, and oversubscribing them produces timeouts that read as product failures: at four
  // local workers, specs that pass alone and pass in CI fail here for no reason anyone can act on.
  // The whole suite runs in about ninety seconds serially, which is not worth trading for that.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }], ['junit', { outputFile: 'results.xml' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    // Logs each role in once through a real browser and saves the session. Every other project
    // depends on this, so a credential problem fails here with a clear message instead of
    // surfacing as every spec failing at its first navigation.
    // testDir is set explicitly because auth.setup.ts sits above ./specs, and testMatch is
    // resolved relative to a project's testDir.
    { name: 'setup', testDir: '.', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
})
