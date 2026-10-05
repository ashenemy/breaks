import { z } from 'zod';

/** Уровень правила линтера. */
const SEVERITY = z.enum(['error', 'off', 'warn']);

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

const TAG = z.string().regex(/^(scope|type|platform):[a-z0-9*.-]+$/, 'тег вида scope:*, type:* или platform:*');

const CASE = z.enum(['camelCase', 'PascalCase', 'UPPER_CASE', 'snake_case']);

const UNDERSCORE = z.enum(['forbid', 'require', 'requireDouble']);

const MEMBER_KIND = z.enum([
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
    'private-instance-method',
]);

const NAMING_RULE = z.strictObject({
    format: CASE,
    'leading-underscore': UNDERSCORE.default('forbid'),
});

const FORMAT = z.strictObject({
    indent: z.number().int().min(2).max(8).default(4),
    'line-ending': z.enum(['lf']).default('lf'),
    'line-width': z.number().int().min(80).max(200).default(120),
    quotes: z.enum(['single', 'double']).default('single'),
    'trailing-commas': z.enum(['all', 'es5', 'none']).default('all'),
});

const NAMING = z.strictObject({
    'export-const': CASE.default('UPPER_CASE'),
    'static-readonly': CASE.default('UPPER_CASE'),
    public: NAMING_RULE.prefault({ format: 'camelCase' }),
    protected: NAMING_RULE.prefault({ format: 'camelCase', 'leading-underscore': 'require' }),
    private: NAMING_RULE.prefault({ format: 'camelCase', 'leading-underscore': 'requireDouble' }),
    types: CASE.default('PascalCase'),
    'exported-functions': z.enum(['function', 'const']).default('function'),
});

const MEMBERS = z.strictObject({
    order: z.array(MEMBER_KIND).min(1).default(MEMBER_KIND.options),
    'explicit-accessibility': z.boolean().default(true),
    'explicit-return-types': z.boolean().default(true),
    typedef: z.boolean().default(true),
});

const IMPORTS = z.strictObject({
    'type-imports': z.boolean().default(true),
    'type-exports': z.boolean().default(true),
    sort: z.boolean().default(true),
    groups: z.array(z.enum(['builtin', 'external', 'scope', 'relative'])).min(1).default(['builtin', 'external', 'scope', 'relative']),
    scope: z.string().regex(/^@[a-z0-9-]+$/, 'npm-scope вида @market').default('@market'),
    'no-default-export': z.boolean().default(true),
    'no-export-all': z.boolean().default(true),
    'export-exceptions': z.array(z.string()).default(['**/eslint.config.*', '**/vitest.config.*', '**/vite.config.*']),
});

const TYPES = z.strictObject({
    'no-explicit-any': SEVERITY.default('error'),
    'consistent-type-definitions': z.enum(['type', 'interface']).default('type'),
    'any-alias': z.string().default('Any'),
    'any-alias-package': z.string().default('@market/core-ts-utils'),
});

const ANGULAR = z.strictObject({
    'material-allowed-in': z.array(z.string()).default(['packages/ui/ui-web/**']),
    'native-elements': z.array(z.string()).default(['a', 'button', 'input', 'select', 'textarea']),
    'native-elements-allowed-in': z.array(z.string()).default(['packages/ui/ui-web/**']),
});

const I18N = z.strictObject({
    'forbid-hardcoded-text': z.boolean().default(true),
    locales: z.array(z.string().regex(/^[a-z]{2}$/)).min(1).default(['hy', 'ru', 'en']),
    'template-globs': z.array(z.string()).default(['**/*.html']),
    'native-globs': z.array(z.string()).default(['packages/ui/ui-native/**/*.ts']),
});

const CONSTRAINT = z
    .strictObject({
        source: TAG.optional(),
        'all-source': z.array(TAG).min(1).optional(),
        only: z.array(TAG).optional(),
        'not-on': z.array(TAG).optional(),
    })
    .refine((value) => (value.source === undefined) !== (value['all-source'] === undefined), {
        message: 'нужно ровно одно из source или all-source',
    })
    .refine((value) => value.only !== undefined || value['not-on'] !== undefined, {
        message: 'нужно хотя бы одно из only или not-on',
    });

const BOUNDARIES = z.strictObject({
    'enforce-buildable': z.boolean().default(true),
    allow: z.array(z.string()).default([]),
    constraints: z.array(CONSTRAINT).min(1),
});

const COMMIT_TYPE = z.string().regex(/^[a-z]+$/);

const COMMITS = z.strictObject({
    types: z.record(COMMIT_TYPE, z.string().min(1)).refine((value) => Object.keys(value).length > 0, {
        message: 'нужен хотя бы один тип коммита',
    }),
    'root-scopes': z.array(z.string().regex(KEBAB)).min(1).default(['apps', 'packages', 'modules', 'root']),
    'subject-max': z.number().int().min(20).max(120).default(72),
    'task-trailer': z.string().default('Task'),
    'substep-trailer': z.string().default('Substep'),
});

const OVERLAP = z
    .strictObject({
        biome: z.array(z.string()).default([]),
        eslint: z.array(z.string()).default([]),
    })
    .refine((value) => value.biome.every((rule) => !value.eslint.includes(rule)), {
        message: 'правило не может быть включено одновременно в Biome и ESLint',
    });

/** Переопределение раздела по платформе: те же ключи, все необязательные и без умолчаний. */
export function overrideOf<T extends z.ZodRawShape>(section: z.ZodObject<T>): z.ZodObject<{ [K in keyof T]: z.ZodOptional<z.ZodType> }> {
    const entries = Object.entries(section.shape).map(([key, field]) => {
        const inner = (field instanceof z.ZodDefault || field instanceof z.ZodPrefault ? field.unwrap() : field) as z.ZodType;
        return [key, inner.optional()] as const;
    });
    return z.strictObject(Object.fromEntries(entries) as { [K in keyof T]: z.ZodOptional<z.ZodType> });
}

const PLATFORM_OVERRIDE = z.strictObject({
    format: overrideOf(FORMAT).optional(),
    naming: overrideOf(NAMING).optional(),
    members: overrideOf(MEMBERS).optional(),
    imports: overrideOf(IMPORTS).optional(),
    types: overrideOf(TYPES).optional(),
});

/**
 * Схема `rules.toml`: разделы по E00.02 (пункт 1) и переопределения по платформам.
 * `prefault` прогоняет пустой раздел через парсинг, чтобы применились умолчания полей.
 */
export const RULES_SCHEMA = z.strictObject({
    format: FORMAT.prefault({}),
    naming: NAMING.prefault({}),
    members: MEMBERS.prefault({}),
    imports: IMPORTS.prefault({}),
    types: TYPES.prefault({}),
    angular: ANGULAR.prefault({}),
    i18n: I18N.prefault({}),
    boundaries: BOUNDARIES,
    commits: COMMITS,
    overlap: OVERLAP.prefault({}),
    platforms: z.partialRecord(z.enum(['api', 'native', 'shared', 'web']), PLATFORM_OVERRIDE).prefault({}),
});
