import { defineConfig } from '@playwright/test';

// The site needs the backend API with a migrated and seeded database
// (see ../backend/README.md). Already running servers are reused locally.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // `npm test` runs the checks; `npm run screenshots` saves screens to ../tmp/preview/.
  projects: [
    { name: 'tests', testMatch: '**/*.spec.ts' },
    { name: 'screenshots', testMatch: '**/*.screens.ts' },
  ],
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    channel: process.env.CI ? undefined : 'chrome',
    viewport: { width: 1440, height: 960 },
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // CI builds the backend beforehand; locally it runs from source.
      command: process.env.CI ? 'node ../backend/dist/index.js' : 'npm --prefix ../backend run dev',
      url: 'http://127.0.0.1:3001/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      // CI serves the build from `npm run build`: the tests check what is deployed and run
      // about twice as fast as on the dev server, which compiles modules on demand.
      command: `node node_modules/vite/bin/vite.js ${process.env.CI ? 'preview ' : ''}--host 127.0.0.1 --port 3000 --strictPort`,
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
