import baseConfig from '../../../eslint.config.mjs';

export default [
    ...baseConfig,
    {
        files: ['**/*.json'],
        rules: {
            '@nx/dependency-checks': [
                'error',
                {
                    // Peer-зависимости NestJS: пакет их не импортирует, но без них @nestjs/common не работает;
                    // версии закреплены явно (ADR-0002, E00.03.04).
                    ignoredDependencies: ['reflect-metadata', 'rxjs'],
                    ignoredFiles: [
                        '{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}',
                        '{projectRoot}/vitest.config.{js,ts,mjs,mts}',
                    ],
                },
            ],
        },
        languageOptions: {
            parser: await import('jsonc-eslint-parser'),
        },
    },
    {
        ignores: ['**/out-tsc'],
    },
];
