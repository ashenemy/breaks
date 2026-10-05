import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { overrideOf, RULES_SCHEMA } from '../../src/lib/rules-schema.js';

describe('overrideOf', () => {
    it('снимает умолчания и делает все поля необязательными, сохраняя проверки', () => {
        const section = z.strictObject({
            plain: z.number().int(),
            withDefault: z.string().default('x'),
            withPrefault: z.strictObject({ a: z.number().default(1) }).prefault({}),
        });
        const override = overrideOf(section);
        expect(override.parse({})).toEqual({});
        expect(override.parse({ plain: 2, withDefault: 'y', withPrefault: { a: 3 } })).toEqual({
            plain: 2,
            withDefault: 'y',
            withPrefault: { a: 3 },
        });
        expect(override.safeParse({ plain: 1.5 }).success).toBe(false);
        expect(override.safeParse({ unknown: true }).success).toBe(false);
    });
});

const MINIMAL = {
    boundaries: { constraints: [{ source: 'type:core', only: ['type:core'] }] },
    commits: { types: { feat: '✨' } },
};

describe('RULES_SCHEMA: умолчания', () => {
    it('заполняет разделы значениями конвенций', () => {
        const config = RULES_SCHEMA.parse(MINIMAL);
        expect(config.format).toEqual({
            indent: 4,
            'line-ending': 'lf',
            'line-width': 120,
            'parameter-decorators': true,
            quotes: 'single',
            'trailing-commas': 'all',
        });
        expect(config.naming.private).toEqual({ format: 'camelCase', 'leading-underscore': 'requireDouble' });
        expect(config.naming.protected['leading-underscore']).toBe('require');
        expect(config.naming.public['leading-underscore']).toBe('forbid');
        expect(config.naming['export-const']).toBe('UPPER_CASE');
        expect(config.members.order[0]).toBe('public-static-field');
        expect(config.members.order.at(-1)).toBe('private-instance-method');
        expect(config.types['no-explicit-any']).toBe('error');
        expect(config.types['consistent-type-definitions']).toBe('type');
        expect(config.imports['no-default-export']).toBe(true);
        expect(config.i18n.locales).toEqual(['hy', 'ru', 'en']);
        expect(config.commits['subject-max']).toBe(72);
        expect(config.platforms).toEqual({});
    });
});

describe('RULES_SCHEMA: обязательные разделы и проверки', () => {
    it('требует boundaries и commits', () => {
        const result = RULES_SCHEMA.safeParse({});
        expect(result.success).toBe(false);
        const paths = result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
        expect(paths).toEqual(expect.arrayContaining(['boundaries', 'commits']));
    });

    it('отклоняет неизвестные ключи', () => {
        const result = RULES_SCHEMA.safeParse({ ...MINIMAL, format: { indent: 4, tabs: true } });
        expect(result.success).toBe(false);
    });

    it('проверяет формат тегов и состав ограничения границ', () => {
        expect(
            RULES_SCHEMA.safeParse({
                ...MINIMAL,
                boundaries: { constraints: [{ source: 'layer:core', only: ['type:core'] }] },
            }).success,
        ).toBe(false);
        expect(
            RULES_SCHEMA.safeParse({ ...MINIMAL, boundaries: { constraints: [{ only: ['type:core'] }] } }).success,
        ).toBe(false);
        expect(
            RULES_SCHEMA.safeParse({
                ...MINIMAL,
                boundaries: {
                    constraints: [{ source: 'type:core', 'all-source': ['type:core'], only: ['type:core'] }],
                },
            }).success,
        ).toBe(false);
        expect(
            RULES_SCHEMA.safeParse({ ...MINIMAL, boundaries: { constraints: [{ source: 'type:core' }] } }).success,
        ).toBe(false);
        expect(
            RULES_SCHEMA.safeParse({
                ...MINIMAL,
                boundaries: {
                    constraints: [{ 'all-source': ['scope:shared', 'type:core'], 'not-on': ['scope:catalog'] }],
                },
            }).success,
        ).toBe(true);
    });

    it('не допускает одно правило сразу в Biome и ESLint', () => {
        const result = RULES_SCHEMA.safeParse({
            ...MINIMAL,
            overlap: { biome: ['noExplicitAny'], eslint: ['noExplicitAny'] },
        });
        expect(result.success).toBe(false);
    });

    it('проверяет границы чисел и перечисления', () => {
        expect(RULES_SCHEMA.safeParse({ ...MINIMAL, format: { indent: 1 } }).success).toBe(false);
        expect(RULES_SCHEMA.safeParse({ ...MINIMAL, format: { 'line-ending': 'crlf' } }).success).toBe(false);
        expect(RULES_SCHEMA.safeParse({ ...MINIMAL, commits: { types: { 'feat!': '✨' } } }).success).toBe(false);
        expect(RULES_SCHEMA.safeParse({ ...MINIMAL, commits: { types: {} } }).success).toBe(false);
        expect(RULES_SCHEMA.safeParse({ ...MINIMAL, i18n: { locales: ['hye'] } }).success).toBe(false);
        expect(RULES_SCHEMA.safeParse({ ...MINIMAL, platforms: { ios: {} } }).success).toBe(false);
    });

    it('принимает частичные переопределения по платформам', () => {
        const config = RULES_SCHEMA.parse({
            ...MINIMAL,
            platforms: { web: { members: { 'explicit-return-types': false } } },
        });
        expect(config.platforms.web?.members).toEqual({ 'explicit-return-types': false });
    });

    it('переопределения не подтягивают умолчания вложенных разделов и проверяют значения', () => {
        const config = RULES_SCHEMA.parse({ ...MINIMAL, platforms: { api: { naming: { types: 'PascalCase' } } } });
        expect(config.platforms.api?.naming).toEqual({ types: 'PascalCase' });
        expect(
            RULES_SCHEMA.safeParse({ ...MINIMAL, platforms: { api: { naming: { types: 'kebab-case' } } } }).success,
        ).toBe(false);
        expect(RULES_SCHEMA.safeParse({ ...MINIMAL, platforms: { api: { format: { tabs: true } } } }).success).toBe(
            false,
        );
    });
});
