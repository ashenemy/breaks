import { defineConfig } from 'vitest/config';

export default defineConfig({
    root: import.meta.dirname,
    cacheDir: '../../../node_modules/.vite/packages/tooling/lint-e2e',
    test: {
        name: 'tooling-lint-e2e',
        watch: false,
        globals: false,
        environment: 'node',
        include: ['test/**/*.spec.ts'],
        reporters: ['default'],
        testTimeout: 180_000,
        hookTimeout: 180_000,
        passWithNoTests: false,
        coverage: {
            provider: 'v8',
            reportsDirectory: './test-output/vitest/coverage',
            include: ['src/**/*.ts'],
            exclude: ['src/@types/**', 'src/index.ts'],
            thresholds: {
                lines: 90,
                branches: 90,
            },
        },
    },
});
