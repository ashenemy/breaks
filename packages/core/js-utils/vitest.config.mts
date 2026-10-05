import { defineConfig } from 'vitest/config';

export default defineConfig({
    root: import.meta.dirname,
    cacheDir: '../../../node_modules/.vite/packages/core/js-utils',
    test: {
        name: 'core-js-utils',
        watch: false,
        globals: false,
        environment: 'node',
        include: ['test/**/*.spec.ts'],
        reporters: ['default'],
        passWithNoTests: false,
        // Спеки содержат утверждения expectTypeOf: прогон через tsc делает их проверяемыми.
        typecheck: {
            enabled: true,
            include: ['test/**/*.spec.ts'],
            tsconfig: './tsconfig.spec.json',
        },
        coverage: {
            provider: 'v8',
            reportsDirectory: './test-output/vitest/coverage',
            include: ['src/**/*.ts'],
            exclude: ['src/@types/**', 'src/index.ts'],
            thresholds: {
                lines: 95,
                branches: 95,
            },
        },
    },
});
