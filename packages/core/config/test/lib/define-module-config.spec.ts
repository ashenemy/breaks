import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';

import type { ConfigTree, LoadedConfig, ModuleConfig } from '../../src/index.js';
import {
    ConfigError,
    ConfigValidationError,
    defineModuleConfig,
    keyToEnvSegment,
    loadModuleConfig,
    MODULES_SECTION,
    ModuleConfigReader,
    ModuleConfigToken,
} from '../../src/index.js';

const CATALOG = defineModuleConfig(
    'catalog',
    z.strictObject({
        pageSize: z.number().int().positive(),
        host: z.string(),
        cache: z.strictObject({ ttlSeconds: z.number().int().default(60) }).default({ ttlSeconds: 60 }),
        tags: z.array(z.string()).default([]),
    }),
);
const MAIL = defineModuleConfig('mail', z.looseObject({ from: z.email().default('noreply@example.am') }));
const PAYMENTS = defineModuleConfig(
    'payments',
    z.strictObject({ apiKey: z.string().min(1), currency: z.enum(['AMD', 'USD']).default('AMD') }),
);

function loaded(tree: ConfigTree, envPrefix = 'APP'): LoadedConfig {
    return { environment: 'test', envPrefix, fileTree: tree, layers: [], tree };
}

function issuesOf(action: () => unknown): ConfigValidationError {
    try {
        action();
    } catch (error) {
        return error as ConfigValidationError;
    }
    throw new Error('ожидалась ошибка');
}

describe('defineModuleConfig', () => {
    it('создаёт токен с именем, путём раздела и схемой', () => {
        expect(CATALOG).toBeInstanceOf(ModuleConfigToken);
        expect(CATALOG.name).toBe('catalog');
        expect(CATALOG.path).toBe(`${MODULES_SECTION}.catalog`);
        expect(CATALOG.schema.safeParse({ pageSize: 1, host: 'h' }).success).toBe(true);
        expectTypeOf<ModuleConfig<typeof CATALOG>>().toEqualTypeOf<
            Readonly<{ pageSize: number; host: string; cache: { ttlSeconds: number }; tags: string[] }>
        >();
    });

    it('называет переменную окружения для ключа, в том числе вложенного и с другим префиксом', () => {
        expect(CATALOG.envVariable(['pageSize'])).toBe('APP__MODULES__CATALOG__PAGE_SIZE');
        expect(CATALOG.envVariable(['cache', 'ttlSeconds'])).toBe('APP__MODULES__CATALOG__CACHE__TTL_SECONDS');
        expect(defineModuleConfig('customInvoice', z.object({})).envVariable(['s3Bucket'], 'MARKET')).toBe(
            'MARKET__MODULES__CUSTOM_INVOICE__S3_BUCKET',
        );
        expect(keyToEnvSegment('maxUrlLength')).toBe('MAX_URL_LENGTH');
    });

    it('отвергает имя модуля не в camelCase', () => {
        for (const name of ['Catalog', 'custom-invoice', 'custom_invoice', '1x', '']) {
            expect(() => defineModuleConfig(name, z.object({})), name).toThrow(ConfigError);
        }
        expect(() => defineModuleConfig('Catalog', z.object({}))).toThrow(
            /defineModuleConfig: имя модуля .* "Catalog"/,
        );
    });
});

describe('ModuleConfigReader', () => {
    const tree: ConfigTree = {
        app: { name: 'market' },
        modules: {
            catalog: { pageSize: 20, host: 'db' },
            mail: { from: 'sales@example.am', replyTo: 'x@example.am' },
            broken: 5,
        },
    };

    it('читает только свой раздел, применяет умолчания схемы, замораживает и кэширует результат', () => {
        const reader = new ModuleConfigReader(loaded(tree));
        const catalog = reader.read(CATALOG);
        expect(catalog).toEqual({ pageSize: 20, host: 'db', cache: { ttlSeconds: 60 }, tags: [] });
        expect(Object.isFrozen(catalog)).toBe(true);
        expect(Object.isFrozen(catalog.cache)).toBe(true);
        expect(reader.read(CATALOG)).toBe(catalog);
        expect(reader.config.tree).toBe(tree);
        expect(reader.section(CATALOG)).toEqual({ pageSize: 20, host: 'db' });
    });

    it('модуль не видит чужие разделы и корень дерева даже со свободной схемой', () => {
        const mail = new ModuleConfigReader(loaded(tree)).read(MAIL);
        expect(mail).toEqual({ from: 'sales@example.am', replyTo: 'x@example.am' });
        expect(Object.keys(mail)).not.toContain('catalog');
        expect(Object.keys(mail)).not.toContain('app');
    });

    it('отсутствующий раздел читается как пустая таблица: умолчания работают, обязательные ключи дают ошибку', () => {
        const reader = new ModuleConfigReader(loaded({ app: { name: 'market' } }));
        expect(reader.section(MAIL)).toEqual({});
        expect(reader.read(MAIL)).toEqual({ from: 'noreply@example.am' });

        const error = issuesOf(() => reader.read(PAYMENTS));
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect(error).toBeInstanceOf(ConfigError);
        expect(error.module).toBe('payments');
        expect(error.issues).toEqual([
            {
                message: expect.stringMatching(
                    /^Неверный ввод: ожидалось .+, получено .+ \(ключ "apiKey" в \[modules\.payments\] или переменная APP__MODULES__PAYMENTS__API_KEY\)$/,
                ),
                path: 'apiKey',
                source: 'modules.payments',
            },
        ]);
        expect(error.message).toContain('Конфигурация модуля "payments" не прошла валидацию');
        expect(error.message).toContain('modules.payments → apiKey');
    });

    it('собирает все проблемы раздела сразу: тип, отсутствие ключа, опечатка в ключе', () => {
        const error = issuesOf(() =>
            new ModuleConfigReader(loaded({ modules: { catalog: { pageSize: 'many', pageSise: 1 } } })).read(CATALOG),
        );
        expect(error.module).toBe('catalog');
        expect(error.issues.map((issue) => issue.path).sort()).toEqual(['', 'host', 'pageSize']);
        const byPath = Object.fromEntries(error.issues.map((issue) => [issue.path, issue.message]));
        expect(byPath['pageSize']).toMatch(/ожидалось/);
        expect(byPath['pageSize']).not.toContain('переменная');
        expect(byPath['host']).toContain('APP__MODULES__CATALOG__HOST');
        expect(byPath['']).toContain('pageSise');
        expect(error.issues.every((issue) => issue.source === 'modules.catalog')).toBe(true);
    });

    it('скаляр вместо таблицы раздела даёт ошибку на корне раздела без подсказки', () => {
        const error = issuesOf(() =>
            new ModuleConfigReader(loaded(tree)).read(defineModuleConfig('broken', z.object({}))),
        );
        expect(error.issues).toEqual([
            {
                message: expect.stringMatching(/^Неверный ввод: ожидалось .+, получено .+$/),
                path: '',
                source: 'modules.broken',
            },
        ]);
    });

    it('подставляет префикс переменных из загруженного конфига', () => {
        const error = issuesOf(() => new ModuleConfigReader(loaded({}, 'MARKET')).read(PAYMENTS));
        expect(error.issues[0]?.message).toContain('MARKET__MODULES__PAYMENTS__API_KEY');
    });
});

describe('loadModuleConfig', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'market-config-define-'));
    const configDir = join(rootDir, 'config');
    mkdirSync(configDir);
    writeFileSync(join(configDir, 'default.toml'), '[modules.catalog]\npageSize = 20\nhost = "db"\n');

    afterAll(() => {
        rmSync(rootDir, { recursive: true, force: true });
    });

    it('читает раздел с диска с учётом переопределений окружением (секрет только из окружения)', () => {
        const options = {
            configDir,
            dotenvPath: null,
            env: { APP__MODULES__CATALOG__PAGE_SIZE: '50', APP__MODULES__PAYMENTS__API_KEY: 'sk_test' },
        };
        expect(loadModuleConfig(CATALOG, options)).toEqual({
            pageSize: 50,
            host: 'db',
            cache: { ttlSeconds: 60 },
            tags: [],
        });
        expect(loadModuleConfig(PAYMENTS, options)).toEqual({ apiKey: 'sk_test', currency: 'AMD' });
    });

    it('падает с ConfigValidationError, если переопределение нарушает схему', () => {
        const options = { configDir, dotenvPath: null, env: { APP__MODULES__CATALOG__PAGE_SIZE: '-1' } };
        expect(() => loadModuleConfig(CATALOG, options)).toThrow(ConfigValidationError);
        expect(() => loadModuleConfig(CATALOG, options)).toThrow(
            /modules\.catalog → pageSize: Слишком маленькое значение/,
        );
    });
});
