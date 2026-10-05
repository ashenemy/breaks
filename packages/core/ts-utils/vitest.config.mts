import { defineConfig } from 'vitest/config';

export default defineConfig({
    root: import.meta.dirname,
    cacheDir: '../../../node_modules/.vite/packages/core/ts-utils',
    test: {
        name: 'core-ts-utils',
        watch: false,
        globals: false,
        environment: 'node',
        include: ['test/**/*.spec.ts'],
        reporters: ['default'],
        passWithNoTests: false,
        // Пакет только с типами: каждая спека прогоняется и как обычный тест, и через tsc,
        // чтобы несовпадения expectTypeOf и неиспользованные @ts-expect-error валили прогон.
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
                lines: 90,
                branches: 90,
            },
        },
    },
});
