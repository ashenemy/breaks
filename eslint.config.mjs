// Сгенерировано из packages/tooling/lint/rules.toml пакетом @market/tooling-lint. Не редактировать вручную.
import nx from '@nx/eslint-plugin';

export default [
    ...nx.configs['flat/base'],
    ...nx.configs['flat/typescript'],
    ...nx.configs['flat/javascript'],
    {
        ignores: [
            '**/dist',
            '**/out-tsc',
            '**/coverage',
            '**/test-output',
            '**/.nx',
            'tmp',
            '**/vitest.config.*.timestamp*',
            '**/*.template'
        ]
    },
    {
        files: [
            '**/*.ts',
            '**/*.tsx',
            '**/*.cts',
            '**/*.mts',
            '**/*.js',
            '**/*.jsx',
            '**/*.cjs',
            '**/*.mjs'
        ],
        rules: {
            '@nx/enforce-module-boundaries': [
                'error',
                {
                    enforceBuildableLibDependency: true,
                    allow: [
                        '^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'
                    ],
                    depConstraints: [
                        {
                            sourceTag: 'platform:api',
                            onlyDependOnLibsWithTags: [
                                'platform:api',
                                'platform:shared'
                            ]
                        },
                        {
                            sourceTag: 'platform:web',
                            onlyDependOnLibsWithTags: [
                                'platform:web',
                                'platform:shared'
                            ]
                        },
                        {
                            sourceTag: 'platform:native',
                            onlyDependOnLibsWithTags: [
                                'platform:native',
                                'platform:shared'
                            ]
                        },
                        {
                            sourceTag: 'platform:shared',
                            onlyDependOnLibsWithTags: [
                                'platform:shared'
                            ]
                        },
                        {
                            sourceTag: 'type:app',
                            onlyDependOnLibsWithTags: [
                                'type:module',
                                'type:ui',
                                'type:infra',
                                'type:contracts',
                                'type:core'
                            ]
                        },
                        {
                            sourceTag: 'type:module',
                            onlyDependOnLibsWithTags: [
                                'type:module',
                                'type:ui',
                                'type:infra',
                                'type:contracts',
                                'type:core'
                            ]
                        },
                        {
                            sourceTag: 'type:ui',
                            onlyDependOnLibsWithTags: [
                                'type:ui',
                                'type:contracts',
                                'type:core'
                            ]
                        },
                        {
                            sourceTag: 'type:infra',
                            onlyDependOnLibsWithTags: [
                                'type:infra',
                                'type:contracts',
                                'type:core'
                            ]
                        },
                        {
                            sourceTag: 'type:contracts',
                            onlyDependOnLibsWithTags: [
                                'type:contracts',
                                'type:core'
                            ]
                        },
                        {
                            sourceTag: 'type:core',
                            onlyDependOnLibsWithTags: [
                                'type:core'
                            ]
                        },
                        {
                            sourceTag: 'type:tooling',
                            onlyDependOnLibsWithTags: [
                                'type:tooling',
                                'type:module',
                                'type:ui',
                                'type:infra',
                                'type:contracts',
                                'type:core'
                            ]
                        },
                        {
                            allSourceTags: [
                                'scope:shared',
                                'type:core'
                            ],
                            onlyDependOnLibsWithTags: [
                                'scope:shared'
                            ]
                        },
                        {
                            allSourceTags: [
                                'scope:shared',
                                'type:contracts'
                            ],
                            onlyDependOnLibsWithTags: [
                                'scope:shared'
                            ]
                        },
                        {
                            allSourceTags: [
                                'scope:shared',
                                'type:ui'
                            ],
                            onlyDependOnLibsWithTags: [
                                'scope:shared'
                            ]
                        },
                        {
                            allSourceTags: [
                                'scope:shared',
                                'type:infra'
                            ],
                            onlyDependOnLibsWithTags: [
                                'scope:shared'
                            ]
                        },
                        {
                            allSourceTags: [
                                'scope:shared',
                                'type:module'
                            ],
                            onlyDependOnLibsWithTags: [
                                'scope:shared'
                            ]
                        },
                        {
                            sourceTag: 'scope:*',
                            onlyDependOnLibsWithTags: [
                                'scope:*'
                            ]
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            '**/*.ts',
            '**/*.tsx',
            '**/*.cts',
            '**/*.mts'
        ],
        rules: {
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'variable',
                    modifiers: [
                        'exported',
                        'const'
                    ],
                    format: [
                        'UPPER_CASE'
                    ]
                },
                {
                    selector: 'classProperty',
                    modifiers: [
                        'public',
                        'static',
                        'readonly'
                    ],
                    format: [
                        'UPPER_CASE'
                    ]
                },
                {
                    selector: [
                        'classProperty',
                        'classMethod',
                        'accessor'
                    ],
                    modifiers: [
                        'private'
                    ],
                    format: [
                        'camelCase'
                    ],
                    leadingUnderscore: 'requireDouble'
                },
                {
                    selector: [
                        'classProperty',
                        'classMethod',
                        'accessor'
                    ],
                    modifiers: [
                        'protected'
                    ],
                    format: [
                        'camelCase'
                    ],
                    leadingUnderscore: 'require'
                },
                {
                    selector: [
                        'classProperty',
                        'classMethod',
                        'accessor'
                    ],
                    modifiers: [
                        'public'
                    ],
                    format: [
                        'camelCase'
                    ],
                    leadingUnderscore: 'forbid'
                },
                {
                    selector: 'typeLike',
                    format: [
                        'PascalCase'
                    ]
                },
                {
                    selector: 'variable',
                    modifiers: [
                        'const'
                    ],
                    format: [
                        'camelCase',
                        'UPPER_CASE'
                    ]
                },
                {
                    selector: [
                        'objectLiteralProperty',
                        'typeProperty'
                    ],
                    modifiers: [
                        'requiresQuotes'
                    ],
                    format: null
                },
                {
                    selector: [
                        'objectLiteralProperty',
                        'typeProperty'
                    ],
                    format: [
                        'camelCase',
                        'UPPER_CASE'
                    ]
                },
                {
                    selector: 'import',
                    format: [
                        'camelCase',
                        'PascalCase'
                    ]
                },
                {
                    selector: 'default',
                    format: [
                        'camelCase'
                    ],
                    leadingUnderscore: 'allow'
                }
            ],
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > :matches(ArrowFunctionExpression, FunctionExpression)',
                    message: 'Экспортируемые функции объявляются через export function, а не export const.'
                },
                {
                    selector: 'ExportDefaultDeclaration',
                    message: 'Только именованные экспорты через src/index.ts.'
                },
                {
                    selector: 'ExportAllDeclaration',
                    message: 'export * запрещён: перечисляйте экспорты явно.'
                }
            ],
            '@typescript-eslint/member-ordering': [
                'error',
                {
                    default: {
                        memberTypes: [
                            'public-static-field',
                            'protected-static-field',
                            'private-static-field',
                            'public-instance-field',
                            'protected-instance-field',
                            'private-instance-field',
                            'public-static-method',
                            'protected-static-method',
                            'private-static-method',
                            'constructor',
                            'public-instance-method',
                            'protected-instance-method',
                            'private-instance-method'
                        ]
                    }
                }
            ],
            '@typescript-eslint/explicit-member-accessibility': [
                'error',
                {
                    accessibility: 'explicit',
                    overrides: {
                        constructors: 'no-public'
                    }
                }
            ],
            '@typescript-eslint/explicit-function-return-type': [
                'error',
                {
                    allowExpressions: true,
                    allowHigherOrderFunctions: true,
                    allowTypedFunctionExpressions: true
                }
            ],
            '@typescript-eslint/typedef': [
                'error',
                {
                    memberVariableDeclaration: true,
                    propertyDeclaration: true
                }
            ],
            '@typescript-eslint/consistent-type-definitions': [
                'error',
                'type'
            ],
            '@typescript-eslint/no-inferrable-types': 'off',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/consistent-type-imports': 'off',
            '@typescript-eslint/consistent-type-exports': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            'no-unused-vars': 'off',
            'sort-imports': 'off'
        }
    },
    {
        files: [
            '**/eslint.config.*',
            '**/vitest.config.*',
            '**/vite.config.*'
        ],
        rules: {
            'no-restricted-syntax': 'off'
        }
    },
    {
        files: [
            '**/*.ts',
            '**/*.tsx',
            '**/*.cts',
            '**/*.mts'
        ],
        ignores: [
            'packages/ui/ui-web/**'
        ],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '@angular/material',
                                '@angular/material/*',
                                '@angular/cdk',
                                '@angular/cdk/*'
                            ],
                            message: 'Angular Material и CDK разрешены только внутри packages/ui/ui-web.'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            'apps/web-*/**/*.ts',
            'apps/web-*/**/*.tsx',
            'apps/web-*/**/*.cts',
            'apps/web-*/**/*.mts',
            'modules/*/web/**/*.ts',
            'modules/*/web/**/*.tsx',
            'modules/*/web/**/*.cts',
            'modules/*/web/**/*.mts',
            'packages/ui/ui-web/**/*.ts',
            'packages/ui/ui-web/**/*.tsx',
            'packages/ui/ui-web/**/*.cts',
            'packages/ui/ui-web/**/*.mts'
        ],
        rules: {
            '@typescript-eslint/explicit-function-return-type': 'off'
        }
    },
    {
        files: ['**/*.json'],
        languageOptions: { parser: await import('jsonc-eslint-parser') },
        rules: {},
    },
];
