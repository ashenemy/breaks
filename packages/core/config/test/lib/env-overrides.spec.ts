import { describe, expect, it } from 'vitest';

import type { ConfigTree } from '../../src/index.js';
import {
    type ConfigError,
    coerceEnvValue,
    DEFAULT_ENV_PREFIX,
    ENV_SEPARATOR,
    EnvOverrides,
    envSegmentToKey,
} from '../../src/index.js';

function issuesOf(action: () => unknown): ConfigError['issues'] {
    try {
        action();
    } catch (error) {
        return (error as ConfigError).issues;
    }
    throw new Error('ожидалась ошибка');
}

describe('envSegmentToKey', () => {
    it('переводит UPPER_SNAKE_CASE в camelCase', () => {
        expect(envSegmentToKey('CATALOG')).toBe('catalog');
        expect(envSegmentToKey('PAGE_SIZE')).toBe('pageSize');
        expect(envSegmentToKey('S3_BUCKET_NAME')).toBe('s3BucketName');
        expect(envSegmentToKey('MAX_URL_LENGTH')).toBe('maxUrlLength');
    });
});

describe('coerceEnvValue', () => {
    it('строка из TOML остаётся строкой, даже если похожа на число', () => {
        expect(coerceEnvValue('8080', 'db', 'X', 'a')).toBe('8080');
        expect(coerceEnvValue('true', 'yes', 'X', 'a')).toBe('true');
    });

    it('число из TOML требует число, логическое значение — строго true или false', () => {
        expect(coerceEnvValue('50', 20, 'X', 'a')).toBe(50);
        expect(coerceEnvValue(' 1.5 ', 0.1, 'X', 'a')).toBe(1.5);
        expect(coerceEnvValue('true', false, 'X', 'a')).toBe(true);
        expect(coerceEnvValue('false', true, 'X', 'a')).toBe(false);
        expect(issuesOf(() => coerceEnvValue('many', 1, 'APP__A', 'a'))).toEqual([
            { message: 'ожидается число, получено "many"', path: 'a', source: 'APP__A' },
        ]);
        expect(issuesOf(() => coerceEnvValue('', 1, 'APP__A', 'a'))[0]?.message).toContain('ожидается число');
        expect(issuesOf(() => coerceEnvValue('yes', true, 'APP__A', 'a'))).toEqual([
            { message: 'ожидается true или false, получено "yes"', path: 'a', source: 'APP__A' },
        ]);
    });

    it('без текущего значения читает литерал TOML, иначе оставляет строку', () => {
        expect(coerceEnvValue('20', undefined, 'X', 'a')).toBe(20);
        expect(coerceEnvValue('true', undefined, 'X', 'a')).toBe(true);
        expect(coerceEnvValue('["a", "b"]', undefined, 'X', 'a')).toEqual(['a', 'b']);
        expect(coerceEnvValue('{ host = "h", port = 1 }', undefined, 'X', 'a')).toEqual({ host: 'h', port: 1 });
        expect(coerceEnvValue('"1.2"', undefined, 'X', 'a')).toBe('1.2');
        expect(coerceEnvValue('eu-central-1', undefined, 'X', 'a')).toBe('eu-central-1');
        expect(coerceEnvValue('noreply@example.com', undefined, 'X', 'a')).toBe('noreply@example.com');
        expect(coerceEnvValue('', undefined, 'X', 'a')).toBe('');
        expect(coerceEnvValue('1\nother = 2', undefined, 'X', 'a')).toBe('1\nother = 2');
        expect(coerceEnvValue('1 } \n[other]', undefined, 'X', 'a')).toBe('1 } \n[other]');
    });

    it('таблица или массив из TOML заменяются литералом целиком', () => {
        expect(coerceEnvValue('[1, 2]', ['a'], 'X', 'a')).toEqual([1, 2]);
        expect(coerceEnvValue('plain', { x: 1 }, 'X', 'a')).toBe('plain');
    });
});

describe('EnvOverrides', () => {
    const overrides = new EnvOverrides();

    it('использует префикс APP__ по умолчанию и позволяет свой', () => {
        expect(DEFAULT_ENV_PREFIX).toBe('APP');
        expect(ENV_SEPARATOR).toBe('__');
        expect(overrides.prefix).toBe('APP__');
        expect(new EnvOverrides('MARKET').prefix).toBe('MARKET__');
        expect(new EnvOverrides('MARKET').collect({ APP__A: '1', MARKET__B: '2' })).toEqual([
            { path: ['b'], raw: '2', variable: 'MARKET__B' },
        ]);
    });

    it('собирает только переменные с префиксом, в алфавитном порядке, пропуская undefined', () => {
        expect(
            overrides.collect({
                PATH: '/bin',
                APP_ENV: 'dev',
                APP__MODULES__CATALOG__PAGE_SIZE: '50',
                APP__APP__NAME: 'market',
                APP__MODULES__MAIL__FROM: undefined,
            }),
        ).toEqual([
            { path: ['app', 'name'], raw: 'market', variable: 'APP__APP__NAME' },
            { path: ['modules', 'catalog', 'pageSize'], raw: '50', variable: 'APP__MODULES__CATALOG__PAGE_SIZE' },
        ]);
    });

    it('отвергает имена вне формата одной ошибкой на все переменные', () => {
        const env = Object.fromEntries([
            ['APP__', '1'],
            ['APP__a__B', '2'],
            ['APP___X', '3'],
            ['APP__OK__Y_', '4'],
            ['APP__FINE', '5'],
        ]);
        const issues = issuesOf(() => overrides.collect(env));
        expect(issues.map((issue) => issue.source)).toEqual(['APP__', 'APP__OK__Y_', 'APP___X', 'APP__a__B']);
        expect(issues[0]?.message).toContain('APP__SEGMENT__SEGMENT');
    });

    it('применяет переопределения поверх дерева, не изменяя исходное', () => {
        const tree: ConfigTree = { modules: { catalog: { pageSize: 20, host: 'db', cache: true } } };
        const result = overrides.apply(tree, {
            APP__MODULES__CATALOG__PAGE_SIZE: '50',
            APP__MODULES__CATALOG__HOST: '8080',
            APP__MODULES__CATALOG__CACHE: 'false',
            APP__MODULES__MAIL__FROM: 'noreply@example.com',
            APP__MODULES__MAIL__RETRIES: '3',
            UNRELATED: 'x',
        });
        expect(result.tree).toEqual({
            modules: {
                catalog: { pageSize: 50, host: '8080', cache: false },
                mail: { from: 'noreply@example.com', retries: 3 },
            },
        });
        expect(result.variables).toEqual([
            'APP__MODULES__CATALOG__CACHE',
            'APP__MODULES__CATALOG__HOST',
            'APP__MODULES__CATALOG__PAGE_SIZE',
            'APP__MODULES__MAIL__FROM',
            'APP__MODULES__MAIL__RETRIES',
        ]);
        expect(tree).toEqual({ modules: { catalog: { pageSize: 20, host: 'db', cache: true } } });
        expect(result.tree['modules']).not.toBe(tree['modules']);
    });

    it('без переопределений возвращает то же дерево и пустой список переменных', () => {
        const tree: ConfigTree = { a: 1 };
        expect(overrides.apply(tree, { HOME: '/home' })).toEqual({ tree, variables: [] });
        expect(overrides.apply(tree, {}).tree).toBe(tree);
    });

    it('не проходит сквозь скаляр и называет переменную, путь и место конфликта', () => {
        const issues = issuesOf(() =>
            overrides.apply({ modules: { catalog: 'flat' } }, { APP__MODULES__CATALOG__X: '1' }),
        );
        expect(issues).toEqual([
            {
                message: 'путь проходит через значение "modules.catalog", которое не является таблицей',
                path: 'modules.catalog.x',
                source: 'APP__MODULES__CATALOG__X',
            },
        ]);
    });

    it('ошибка приведения типа содержит переменную и путь в дереве', () => {
        expect(issuesOf(() => overrides.apply({ a: { b: 1 } }, { APP__A__B: 'nope' }))).toEqual([
            { message: 'ожидается число, получено "nope"', path: 'a.b', source: 'APP__A__B' },
        ]);
    });
});
