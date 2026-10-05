import type { BoundaryConstraint, MembersRules, NamingRules, RulesConfig, TypesRules } from '../@types/index.js';

/** Что доступно в воркспейсе: от этого зависят Angular-блоки конфига. */
export type EslintFeatures = {
    angular: boolean;
};

type RuleLevel = 'error' | 'off' | 'warn';
type RuleEntry = RuleLevel | [RuleLevel, ...unknown[]];
type RuleSet = Record<string, RuleEntry>;
type RestrictedSyntax = { message: string; selector: string };

type ConfigBlock = {
    files?: string[];
    ignores?: string[];
    languageOptions?: Record<string, unknown>;
    rules?: RuleSet;
};

/** Какие правила ESLint отключаются, если правило отдано Biome ([overlap].biome). */
const BIOME_OWNED: Record<string, string[]> = {
    noExplicitAny: ['@typescript-eslint/no-explicit-any'],
    noUnusedImports: ['@typescript-eslint/no-unused-vars', 'no-unused-vars'],
    noUnusedVariables: ['@typescript-eslint/no-unused-vars', 'no-unused-vars'],
    organizeImports: ['sort-imports'],
    useExportType: ['@typescript-eslint/consistent-type-exports'],
    useImportType: ['@typescript-eslint/consistent-type-imports'],
};

const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'];
const ALL_SOURCE = [...TS_FILES, '**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'];
const IGNORES = [
    '**/dist',
    '**/out-tsc',
    '**/coverage',
    '**/test-output',
    '**/.nx',
    'tmp',
    '**/vitest.config.*.timestamp*',
    '**/*.template',
];

/** Файлы платформ для переопределений `[platforms.*]` (01-architecture.md, раздел 4). */
export const PLATFORM_GLOBS: Record<'api' | 'native' | 'shared' | 'web', string[]> = {
    api: ['apps/api/**', 'apps/worker/**', 'modules/*/api/**', 'packages/infra/**', 'packages/tooling/**'],
    native: ['apps/mobile-*/**', 'modules/*/native/**', 'packages/ui/ui-native/**'],
    shared: ['packages/core/**', 'packages/contracts/**', 'packages/ui/ui-contracts/**', 'packages/design/**'],
    web: ['apps/web-*/**', 'modules/*/web/**', 'packages/ui/ui-web/**'],
};

const MEMBER_SELECTORS = ['classProperty', 'classMethod', 'accessor'];

function namingRules(naming: NamingRules): RuleSet {
    const options: Record<string, unknown>[] = [
        { selector: 'variable', modifiers: ['exported', 'const'], format: [naming['export-const']] },
        { selector: 'classProperty', modifiers: ['public', 'static', 'readonly'], format: [naming['static-readonly']] },
        ...(['private', 'protected', 'public'] as const).map((modifier) => ({
            selector: MEMBER_SELECTORS,
            modifiers: [modifier],
            format: [naming[modifier].format],
            leadingUnderscore: naming[modifier]['leading-underscore'],
        })),
        { selector: 'typeLike', format: [naming.types] },
        { selector: 'variable', modifiers: ['const'], format: ['camelCase', 'UPPER_CASE'] },
        // Ключи объектов и типов: идентификаторы правил, переменные окружения, ключи TOML в кавычках.
        { selector: ['objectLiteralProperty', 'typeProperty'], modifiers: ['requiresQuotes'], format: null },
        { selector: ['objectLiteralProperty', 'typeProperty'], format: ['camelCase', 'UPPER_CASE'] },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
    ];
    const rules: RuleSet = { '@typescript-eslint/naming-convention': ['error', ...options] };
    if (naming['exported-functions'] === 'function') {
        rules['no-restricted-syntax'] = [
            'error',
            {
                selector:
                    'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > :matches(ArrowFunctionExpression, FunctionExpression)',
                message: 'Экспортируемые функции объявляются через export function, а не export const.',
            },
        ];
    }
    return rules;
}

function memberRules(members: MembersRules): RuleSet {
    const rules: RuleSet = {
        '@typescript-eslint/member-ordering': ['error', { default: { memberTypes: members.order } }],
    };
    if (members['explicit-accessibility']) {
        rules['@typescript-eslint/explicit-member-accessibility'] = [
            'error',
            { accessibility: 'explicit', overrides: { constructors: 'no-public' } },
        ];
    }
    if (members['explicit-return-types']) {
        rules['@typescript-eslint/explicit-function-return-type'] = [
            'error',
            { allowExpressions: true, allowHigherOrderFunctions: true, allowTypedFunctionExpressions: true },
        ];
    }
    if (members.typedef) {
        // Параметры функций типизированы за счёт strict (noImplicitAny); правило следит за полями и свойствами.
        rules['@typescript-eslint/typedef'] = ['error', { memberVariableDeclaration: true, propertyDeclaration: true }];
    }
    return rules;
}

function typeRules(types: TypesRules): RuleSet {
    return {
        '@typescript-eslint/consistent-type-definitions': ['error', types['consistent-type-definitions']],
        // Конвенция требует явные типы членов класса; вывод типов из инициализатора не считается избыточным.
        '@typescript-eslint/no-inferrable-types': 'off',
    };
}

function exportRules(rules: RulesConfig): RestrictedSyntax[] {
    const restrictions: RestrictedSyntax[] = [];
    if (rules.imports['no-default-export']) {
        restrictions.push({
            selector: 'ExportDefaultDeclaration',
            message: 'Только именованные экспорты через src/index.ts.',
        });
    }
    if (rules.imports['no-export-all']) {
        restrictions.push({
            selector: 'ExportAllDeclaration',
            message: 'export * запрещён: перечисляйте экспорты явно.',
        });
    }
    return restrictions;
}

function toDepConstraints(constraints: readonly BoundaryConstraint[]): Record<string, unknown>[] {
    return constraints.map((constraint) => {
        const result: Record<string, unknown> =
            constraint.source !== undefined
                ? { sourceTag: constraint.source }
                : { allSourceTags: constraint['all-source'] };
        if (constraint.only) {
            result['onlyDependOnLibsWithTags'] = constraint.only;
        }
        if (constraint['not-on']) {
            result['notDependOnLibsWithTags'] = constraint['not-on'];
        }
        return result;
    });
}

function mergeRestrictedSyntax(target: RuleSet, extra: RestrictedSyntax[]): void {
    const current = target['no-restricted-syntax'];
    const existing = Array.isArray(current) ? current.slice(1) : [];
    if (existing.length + extra.length > 0) {
        target['no-restricted-syntax'] = ['error', ...existing, ...extra];
    }
}

function tsRules(
    rules: RulesConfig,
    overrides: { members?: MembersRules; naming?: NamingRules; types?: TypesRules } = {},
): RuleSet {
    const set: RuleSet = {
        ...namingRules(overrides.naming ?? rules.naming),
        ...memberRules(overrides.members ?? rules.members),
        ...typeRules(overrides.types ?? rules.types),
    };
    mergeRestrictedSyntax(set, exportRules(rules));
    for (const owned of rules.overlap.biome) {
        for (const ruleId of BIOME_OWNED[owned] ?? []) {
            set[ruleId] = 'off';
        }
    }
    return set;
}

function platformBlocks(rules: RulesConfig): ConfigBlock[] {
    const blocks: ConfigBlock[] = [];
    for (const [platform, override] of Object.entries(rules.platforms)) {
        if (!override) {
            continue;
        }
        const files = PLATFORM_GLOBS[platform as keyof typeof PLATFORM_GLOBS];
        const merged = {
            members: override.members ? { ...rules.members, ...override.members } : undefined,
            naming: override.naming ? { ...rules.naming, ...override.naming } : undefined,
            types: override.types ? { ...rules.types, ...override.types } : undefined,
        };
        const base = tsRules(rules);
        const changed = tsRules(rules, merged as { members?: MembersRules; naming?: NamingRules; types?: TypesRules });
        const diff: RuleSet = {};
        for (const [ruleId, entry] of Object.entries(changed)) {
            if (JSON.stringify(base[ruleId]) !== JSON.stringify(entry)) {
                diff[ruleId] = entry;
            }
        }
        for (const ruleId of Object.keys(base)) {
            if (!(ruleId in changed)) {
                diff[ruleId] = 'off';
            }
        }
        if (Object.keys(diff).length > 0) {
            blocks.push({
                files: files.flatMap((glob) => TS_FILES.map((pattern) => `${glob.replace(/\/\*\*$/, '')}/${pattern}`)),
                rules: diff,
            });
        }
    }
    return blocks;
}

function angularBlocks(rules: RulesConfig): ConfigBlock[] {
    const elements = rules.angular['native-elements'].join('|');
    const selectorRules: RestrictedSyntax[] = ['Element$1', 'Element'].map((node) => ({
        selector: `${node}[name=/^(${elements})$/]`,
        message: 'Нативные элементы запрещены вне ui-web: используйте компоненты @market/ui-web.',
    }));
    return [
        {
            files: ['**/*.html'],
            ignores: rules.angular['native-elements-allowed-in'],
            rules: { 'no-restricted-syntax': ['error', ...selectorRules] },
        },
        ...(rules.i18n['forbid-hardcoded-text']
            ? [
                  {
                      files: rules.i18n['template-globs'],
                      rules: {
                          '@angular-eslint/template/i18n': [
                              'error',
                              {
                                  checkId: false,
                                  checkText: true,
                                  checkAttributes: true,
                                  ignoreAttributes: ['routerLink', 'formControlName'],
                              },
                          ],
                      } as RuleSet,
                  },
              ]
            : []),
    ];
}

function serialize(value: unknown, indent: number): string {
    return JSON.stringify(value, null, indent)
        .replace(/"([A-Za-z_$][\w$]*)":/g, '$1:')
        .replace(/"/g, "'")
        .replace(/\n/g, `\n${' '.repeat(indent)}`);
}

/** Текст `eslint.config.mjs` (flat config) из правил. */
export function buildEslintConfig(rules: RulesConfig, features: EslintFeatures): string {
    const indent = rules.format.indent;
    const blocks: ConfigBlock[] = [
        { ignores: IGNORES },
        {
            files: ALL_SOURCE,
            rules: {
                '@nx/enforce-module-boundaries': [
                    'error',
                    {
                        enforceBuildableLibDependency: rules.boundaries['enforce-buildable'],
                        allow: rules.boundaries.allow,
                        depConstraints: toDepConstraints(rules.boundaries.constraints),
                    },
                ],
            },
        },
        { files: TS_FILES, rules: tsRules(rules) },
        { files: rules.imports['export-exceptions'], rules: { 'no-restricted-syntax': 'off' } },
        {
            files: TS_FILES,
            ignores: rules.angular['material-allowed-in'],
            rules: {
                'no-restricted-imports': [
                    'error',
                    {
                        patterns: [
                            {
                                group: ['@angular/material', '@angular/material/*', '@angular/cdk', '@angular/cdk/*'],
                                message: 'Angular Material и CDK разрешены только внутри packages/ui/ui-web.',
                            },
                        ],
                    },
                ],
            },
        },
        ...platformBlocks(rules),
    ];
    if (features.angular) {
        blocks.push(...angularBlocks(rules));
    }

    const lines: string[] = [
        '// Сгенерировано из packages/tooling/lint/rules.toml пакетом @market/tooling-lint. Не редактировать вручную.',
        "import nx from '@nx/eslint-plugin';",
    ];
    if (features.angular) {
        lines.push("import angular from 'angular-eslint';");
    }
    lines.push(
        '',
        'export default [',
        `${' '.repeat(indent)}...nx.configs['flat/base'],`,
        `${' '.repeat(indent)}...nx.configs['flat/typescript'],`,
        `${' '.repeat(indent)}...nx.configs['flat/javascript'],`,
    );
    if (features.angular) {
        lines.push(
            `${' '.repeat(indent)}...angular.configs.tsRecommended.map((config) => ({ ...config, files: ['**/*.ts'] })),`,
        );
        lines.push(
            `${' '.repeat(indent)}...angular.configs.templateRecommended.map((config) => ({ ...config, files: ['**/*.html'] })),`,
        );
    }
    for (const block of blocks) {
        lines.push(`${' '.repeat(indent)}${serialize(block, indent)},`);
    }
    lines.push(
        `${' '.repeat(indent)}{`,
        `${' '.repeat(indent * 2)}files: ['**/*.json'],`,
        `${' '.repeat(indent * 2)}languageOptions: { parser: await import('jsonc-eslint-parser') },`,
        `${' '.repeat(indent * 2)}rules: {},`,
        `${' '.repeat(indent)}},`,
        '];',
        '',
    );
    return lines.join('\n');
}
