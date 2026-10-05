import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { LoadedConfig, ModuleConfig } from '../../src/index.js';
import {
    ConfigModule,
    ConfigSecretError,
    ConfigValidationError,
    defineModuleConfig,
    InjectModuleConfig,
    LOADED_CONFIG,
    MODULE_CONFIG_READER,
    ModuleConfigReader,
} from '../../src/index.js';

const rootDir = mkdtempSync(join(tmpdir(), 'market-config-nest-'));
const configDir = join(rootDir, 'config');
const secretDir = join(rootDir, 'secret');
mkdirSync(configDir);
mkdirSync(secretDir);
writeFileSync(
    join(configDir, 'default.toml'),
    '[modules.catalog]\npageSize = 20\nhost = "db"\n\n[modules.mail]\nfrom = "a@b.am"\n',
);
writeFileSync(join(secretDir, 'default.toml'), '[modules.mail]\npassword = "leak"\n');

afterAll(() => {
    rmSync(rootDir, { recursive: true, force: true });
});

const CATALOG = defineModuleConfig(
    'catalog',
    z.strictObject({ pageSize: z.number().int().positive(), host: z.string() }),
);
const MAIL = defineModuleConfig('mail', z.strictObject({ from: z.email(), retries: z.number().int().default(3) }));

@Injectable()
class CatalogService {
    public readonly config: ModuleConfig<typeof CATALOG>;

    constructor(@InjectModuleConfig(CATALOG) config: ModuleConfig<typeof CATALOG>) {
        this.config = config;
    }
}

@Module({ exports: [CatalogService], imports: [ConfigModule.forModule(CATALOG)], providers: [CatalogService] })
class CatalogModule {}

@Injectable()
class MailService {
    public readonly config: ModuleConfig<typeof MAIL>;

    public readonly loaded: LoadedConfig;

    constructor(
        @Inject(MAIL.injectionToken) config: ModuleConfig<typeof MAIL>,
        @Inject(LOADED_CONFIG) loaded: LoadedConfig,
    ) {
        this.config = config;
        this.loaded = loaded;
    }
}

@Module({ exports: [MailService], imports: [ConfigModule.forModule(MAIL)], providers: [MailService] })
class MailModule {}

describe('ConfigModule', () => {
    it('forRoot загружает конфиг один раз и даёт разделы модулям через forModule и InjectModuleConfig', async () => {
        const app = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ configDir, dotenvPath: null, env: { APP__MODULES__CATALOG__PAGE_SIZE: '50' } }),
                CatalogModule,
                MailModule,
            ],
        }).compile();

        const catalog = app.get(CatalogService);
        expect(catalog.config).toEqual({ pageSize: 50, host: 'db' });
        expect(Object.isFrozen(catalog.config)).toBe(true);

        const mail = app.get(MailService);
        expect(mail.config).toEqual({ from: 'a@b.am', retries: 3 });
        expect(mail.loaded.environment).toBe('dev');
        expect(mail.loaded.layers.map((layer) => layer.name)).toEqual(['default', 'dev', 'local', 'env']);

        const reader = app.get<ModuleConfigReader>(MODULE_CONFIG_READER);
        expect(reader).toBeInstanceOf(ModuleConfigReader);
        expect(reader.config).toBe(mail.loaded);
        expect(reader.read(CATALOG)).toBe(catalog.config);
        expect(app.get<LoadedConfig>(LOADED_CONFIG)).toBe(mail.loaded);
        await app.close();
    });

    it('ошибка валидации раздела останавливает старт с понятным сообщением', async () => {
        const compile = Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({ configDir, dotenvPath: null, env: { APP__MODULES__CATALOG__PAGE_SIZE: '0' } }),
                CatalogModule,
            ],
        }).compile();
        await expect(compile).rejects.toBeInstanceOf(ConfigValidationError);
        await expect(compile).rejects.toThrow(
            /Конфигурация модуля "catalog" не прошла валидацию:\n {2}- modules\.catalog → pageSize: /,
        );
    });

    it('секрет в TOML останавливает старт ещё при загрузке корневого модуля', async () => {
        const compile = Test.createTestingModule({
            imports: [ConfigModule.forRoot({ configDir: secretDir, dotenvPath: null, env: {} }), MailModule],
        }).compile();
        await expect(compile).rejects.toBeInstanceOf(ConfigSecretError);
        await expect(compile).rejects.toThrow(/APP__MODULES__MAIL__PASSWORD/);
        await expect(compile).rejects.not.toThrow(/leak/);
    });

    it('forModule без forRoot сообщает о недостающем провайдере читателя', async () => {
        const compile = Test.createTestingModule({ imports: [CatalogModule] }).compile();
        await expect(compile).rejects.toThrow(/ModuleConfigReader/);
    });
});
