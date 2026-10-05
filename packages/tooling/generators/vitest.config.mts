import { defineConfig } from 'vitest/config';

export default defineConfig({
    root: import.meta.dirname,
    cacheDir: '../../../node_modules/.vite/packages/tooling/generators',
    test: {
        name: 'tooling-generators',
        watch: false,
        globals: false,
        environment: 'node',
        include: ['test/**/*.spec.ts'],
        reporters: ['default'],
        testTimeout: 60_000,
        hookTimeout: 60_000,
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
