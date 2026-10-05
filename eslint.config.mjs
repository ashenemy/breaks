import nx from '@nx/eslint-plugin';

import { DEP_CONSTRAINTS } from './tools/boundaries/dep-constraints.mjs';

/**
 * Корневой конфиг ESLint. До E00.02 ведётся вручную; затем генерируется из
 * `packages/tooling/lint/rules.toml` и уходит в `.gitignore`.
 * Генератор `@market/tooling:lib` защищает этот файл от перезаписи официальными генераторами Nx.
 */
export default [
    ...nx.configs['flat/base'],
    ...nx.configs['flat/typescript'],
    ...nx.configs['flat/javascript'],
    {
        ignores: ['**/dist', '**/out-tsc', '**/coverage', '**/test-output', 'tmp', '**/vitest.config.*.timestamp*'],
    },
    {
        files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts', '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
        rules: {
            '@nx/enforce-module-boundaries': [
                'error',
                {
                    enforceBuildableLibDependency: true,
                    allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
                    depConstraints: DEP_CONSTRAINTS,
                },
            ],
        },
    },
    {
        // JSON-файлы проектов (package.json, generators.json) проверяются правилами @nx/* в конфигах проектов.
        files: ['**/*.json'],
        rules: {},
        languageOptions: {
            parser: await import('jsonc-eslint-parser'),
        },
    },
];
