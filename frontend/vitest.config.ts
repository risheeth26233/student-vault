import { defineConfig } from 'vitest/config';

// Dedicated Vitest config: GuruGraph foundation tests are pure Node unit tests
// (no DOM), so the app's Vite plugins (React, PWA) are intentionally skipped.
// The Learning Insights UI tests are `.test.tsx` and opt into a DOM via a
// `// @vitest-environment jsdom` docblock; oxc handles the JSX transform.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: false,
  },
});
