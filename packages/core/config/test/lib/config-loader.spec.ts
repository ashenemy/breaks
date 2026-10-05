import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

import type { ConfigTree, LoadedConfig } from '../../src/index.js';
import {
    CONFIG_DIRECTORY,
    ConfigError,
    ConfigLoader,
    DEFAULT_LAYER_FILE,
    DOTENV_FILE,
    loadConfig,
} from '../../src/index.js';

const rootDir = mkdtempSync(join(tmpdir(), 'market-config-loader-'));
const configDir = join(rootDir, CONFIG_DIRECTORY);
const dotenvPath = join(rootDir, DOTENV_FILE);

mkdirSync(configDir);
writeFileSync(
    join(configDir, DEFAULT_LAYER_FILE),
    `
[app]
name = "market"
port = 3000

[modules.catalog]
pageSize = 20
host = "db"
tags = ["default"]

[modules.mail]
from = "noreply@example.am"
`,
);
writeFileSync(join(configDir, 'test.toml'), '[app]\nport = 4000\n\n[modules.catalog]\npageSize = 30\n');
writeFileSync(join(configDir, 'staging.toml'), '[app]\nport = 5000\n');
writeFileSync(join(configDir, 'local.toml'), '[modules.catalog]\ntags = ["local"]\nhost = "localhost"\n');
writeFileSync(
    dotenvPath,
    'APP_ENV=test\nAPP__MODULES__CATALOG__HOST=from-dotenv\nAPP__MODULES__PAYMENTS__API_KEY=sk_test\n',
);

afterAll(() => {
    rmSync(rootDir, { recursive: true, force: true });
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

function modules(config: LoadedConfig): ConfigTree {
    return config.tree['modules'] as ConfigTree;
}

describe('ConfigLoader', () => {
    it('сливает слои по порядку: default, окружение, local, .env, переменные процесса', () => {
        const config = new ConfigLoader({
            configDir,
            dotenvPath,
            env: { APP__MODULES__CATALOG__PAGE_SIZE: '50', APP__APP__DEBUG: 'true' },
        }).load();

        expect(config.environment).toBe('test');
        expect(config.tree).toEqual({
            app: { name: 'market', port: 4000, debug: true },
            modules: {
                catalog: { pageSize: 50, host: 'from-dotenv', tags: ['local'] },
                mail: { from: 'noreply@example.am' },
                payments: { apiKey: 'sk_test' },
            },
        });
    });

    it('переменная процесса сильнее .env, а явное окружение сильнее обеих', () => {
        const fromProcess = new ConfigLoader({
            configDir,
            dotenvPath,
            env: { APP_ENV: 'staging', APP__MODULES__CATALOG__HOST: 'from-process' },
        }).load();
        expect(fromProcess.environment).toBe('staging');
        expect(fromProcess.tree['app']).toEqual({ name: 'market', port: 5000 });
        expect((modules(fromProcess)['catalog'] as ConfigTree)['host']).toBe('from-process');

        const explicit = new ConfigLoader({
            configDir,
            dotenvPath,
            env: { APP_ENV: 'staging' },
            environment: 'dev',
        }).load();
        expect(explicit.environment).toBe('dev');
        expect(explicit.tree['app']).toEqual({ name: 'market', port: 3000 });
    });

    it('fileTree содержит только файлы TOML, оба дерева заморожены, .env не попадает в process.env', () => {
        const config = new ConfigLoader({ configDir, dotenvPath, env: { APP__APP__PORT: '8080' } }).load();
        expect((config.fileTree['app'] as ConfigTree)['port']).toBe(4000);
        expect((config.tree['app'] as ConfigTree)['port']).toBe(8080);
        expect((config.fileTree['modules'] as ConfigTree)['payments']).toBeUndefined();
        expect(Object.isFrozen(config.tree)).toBe(true);
        expect(Object.isFrozen(modules(config)['catalog'])).toBe(true);
        expect(Object.isFrozen(config.fileTree)).toBe(true);
        expect(Object.isFrozen((config.fileTree['modules'] as ConfigTree)['catalog'])).toBe(true);
        expect(process.env['APP__MODULES__PAYMENTS__API_KEY']).toBeUndefined();
    });

    it('перечисляет слои с присутствием и именами переменных без значений', () => {
        const config = new ConfigLoader({ configDir, dotenvPath, env: { APP__APP__PORT: '8080' } }).load();
        expect(config.layers).toEqual([
            { name: 'default', present: true, source: join(configDir, 'default.toml') },
            { name: 'test', present: true, source: join(configDir, 'test.toml') },
            { name: 'local', present: true, source: join(configDir, 'local.toml') },
            { name: 'dotenv', present: true, source: dotenvPath },
            {
                name: 'env',
                present: true,
                source: 'APP__*',
                variables: ['APP__APP__PORT', 'APP__MODULES__CATALOG__HOST', 'APP__MODULES__PAYMENTS__API_KEY'],
            },
        ]);
        expect(JSON.stringify(config.layers)).not.toContain('sk_test');
    });

    it('отсутствующие необязательные слои и отключённый .env отражаются в диагностике', () => {
        const config = new ConfigLoader({ configDir, dotenvPath: null, env: {}, environment: 'prod' }).load();
        expect(config.layers.map((layer) => [layer.name, layer.present])).toEqual([
            ['default', true],
            ['prod', false],
            ['local', true],
            ['env', false],
        ]);
        expect(config.layers.at(-1)?.variables).toEqual([]);
        expect((config.tree['app'] as ConfigTree)['port']).toBe(3000);
    });

    it('без default.toml падает с ConfigError, называя файл и каталог', () => {
        const emptyDir = join(rootDir, 'empty');
        mkdirSync(emptyDir);
        const loader = new ConfigLoader({ configDir: emptyDir, dotenvPath: null, env: {} });
        expect(() => loader.load()).toThrow(ConfigError);
        expect(() => loader.load()).toThrow(join(emptyDir, DEFAULT_LAYER_FILE));
        expect(() => loader.load()).toThrow(/файл обязателен/);
    });

    it('неизвестный APP_ENV и неверное переопределение прерывают загрузку', () => {
        expect(() => new ConfigLoader({ configDir, dotenvPath: null, env: { APP_ENV: 'qa' } }).load()).toThrow(
            /APP_ENV: ожидается одно из/,
        );
        expect(() =>
            new ConfigLoader({ configDir, dotenvPath: null, env: { APP__APP__PORT: 'eighty' } }).load(),
        ).toThrow(/APP__APP__PORT → app\.port: ожидается число/);
    });

    it('поддерживает свой префикс переменных', () => {
        const config = new ConfigLoader({
            configDir,
            dotenvPath: null,
            env: { MARKET__APP__PORT: '1', APP__APP__PORT: '2' },
            envPrefix: 'MARKET',
        }).load();
        expect((config.tree['app'] as ConfigTree)['port']).toBe(1);
        expect(config.layers.at(-1)?.source).toBe('MARKET__*');
    });

    it('по умолчанию берёт <cwd>/config, <cwd>/.env и process.env', () => {
        vi.spyOn(process, 'cwd').mockReturnValue(rootDir);
        vi.stubEnv('APP__MODULES__CATALOG__PAGE_SIZE', '99');
        const loader = new ConfigLoader();
        expect(loader.configDir).toBe(configDir);
        expect(loader.dotenvPath).toBe(dotenvPath);
        expect(loader.layerPath('local')).toBe(join(configDir, 'local.toml'));

        const config = loadConfig();
        expect(config.environment).toBe('test');
        expect((modules(config)['catalog'] as ConfigTree)['pageSize']).toBe(99);
        expect((modules(config)['catalog'] as ConfigTree)['host']).toBe('from-dotenv');
    });
});
