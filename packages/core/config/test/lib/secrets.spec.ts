import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';
import { z } from 'zod';

import type { ConfigTree } from '../../src/index.js';
import {
    ConfigError,
    ConfigLoader,
    ConfigSecretError,
    DEFAULT_SECRET_POLICY,
    defineModuleConfig,
    isSecretKey,
    loadModuleConfig,
    maskSecrets,
    SECRET_KEY_WORDS,
    SECRET_MASK,
    SecretPolicy,
} from '../../src/index.js';

const SECRET_VALUE = 'sk_live_very_secret_value';

describe('SecretPolicy.isSecretKey', () => {
    it('секрет — ключ, последнее слово которого из списка, в любом стиле и во множественном числе', () => {
        expect(SECRET_KEY_WORDS).toEqual(['secret', 'password', 'token', 'key']);
        for (const key of [
            'secret',
            'password',
            'token',
            'key',
            'KEY',
            'apiKey',
            'dbPassword',
            'accessToken',
            'clientSecret',
            'secrets',
            'apiKeys',
            'access_token',
            'client-secret',
            'smtpPassword2',
        ]) {
            expect(isSecretKey(key), key).toBe(key !== 'smtpPassword2');
        }
    });

    it('слово в середине описывает секрет, а не хранит его', () => {
        for (const key of ['tokenTtl', 'passwordMinLength', 'keyPrefix', 'accessKeyId', 'secretRotationDays', 'host']) {
            expect(isSecretKey(key), key).toBe(false);
        }
        for (const key of ['monkey', 'keyboard', 'tokenizer', '']) {
            expect(isSecretKey(key), key).toBe(false);
        }
        expect(isSecretKey('passwords_')).toBe(true);
    });

    it('политика настраивается словами и маской', () => {
        const policy = new SecretPolicy(['pin'], '[скрыто]');
        expect(policy.isSecretKey('cardPin')).toBe(true);
        expect(policy.isSecretKey('apiKey')).toBe(false);
        expect(policy.mask).toBe('[скрыто]');
        expect(policy.maskSecrets({ cardPin: '1234', apiKey: 'x' })).toEqual({ cardPin: '[скрыто]', apiKey: 'x' });
        expect(DEFAULT_SECRET_POLICY.mask).toBe(SECRET_MASK);
    });
});

describe('SecretPolicy.findSecretPaths и maskSecrets', () => {
    const tree: ConfigTree = {
        app: { name: 'market', tokenTtl: 900 },
        modules: {
            payments: { apiKey: SECRET_VALUE, currency: 'AMD', webhook: { signingSecret: 's', url: 'https://x' } },
            mail: { secrets: { user: 'u', smtpPassword: 'p' }, from: 'a@b.am' },
            sms: { apiKeys: ['k1', 'k2'], tokens: [{ value: 't' }] },
        },
    };

    it('перечисляет пути секретов, включая таблицы с секретным именем, не заходя внутрь них', () => {
        expect(DEFAULT_SECRET_POLICY.findSecretPaths(tree)).toEqual([
            'modules.payments.apiKey',
            'modules.payments.webhook.signingSecret',
            'modules.mail.secrets',
            'modules.sms.apiKeys',
            'modules.sms.tokens',
        ]);
        expect(DEFAULT_SECRET_POLICY.findSecretPaths({})).toEqual([]);
    });

    it('маскирует всё под секретными ключами, остальное копирует как есть, вход не меняет', () => {
        const masked = maskSecrets(tree);
        expect(masked).toEqual({
            app: { name: 'market', tokenTtl: 900 },
            modules: {
                payments: {
                    apiKey: SECRET_MASK,
                    currency: 'AMD',
                    webhook: { signingSecret: SECRET_MASK, url: 'https://x' },
                },
                mail: { secrets: { user: SECRET_MASK, smtpPassword: SECRET_MASK }, from: 'a@b.am' },
                sms: { apiKeys: [SECRET_MASK, SECRET_MASK], tokens: [{ value: SECRET_MASK }] },
            },
        });
        expect(JSON.stringify(masked)).not.toContain(SECRET_VALUE);
        expect((tree['modules'] as ConfigTree)['payments']).toMatchObject({ apiKey: SECRET_VALUE });
        expect(masked).not.toBe(tree);
    });

    it('работает с результатом схемы модуля, скалярами и датами', () => {
        const when = new Date(0);
        expect(maskSecrets({ apiKey: 'x', when, list: [1, 'a'] })).toEqual({
            apiKey: SECRET_MASK,
            when,
            list: [1, 'a'],
        });
        expect(maskSecrets('plain')).toBe('plain');
        expect(maskSecrets(null)).toBeNull();
        expect(maskSecrets([{ password: 'p' }])).toEqual([{ password: SECRET_MASK }]);
    });

    it('assertNoSecrets бросает ConfigSecretError с файлом, путями и переменными, без значений', () => {
        expect(() => DEFAULT_SECRET_POLICY.assertNoSecrets({ app: { name: 'x' } }, 'default.toml')).not.toThrow();
        let caught: ConfigSecretError | undefined;
        try {
            DEFAULT_SECRET_POLICY.assertNoSecrets(tree, 'config/default.toml', 'MARKET');
        } catch (error) {
            caught = error as ConfigSecretError;
        }
        expect(caught).toBeInstanceOf(ConfigSecretError);
        expect(caught).toBeInstanceOf(ConfigError);
        expect(caught?.paths).toEqual([
            'modules.payments.apiKey',
            'modules.payments.webhook.signingSecret',
            'modules.mail.secrets',
            'modules.sms.apiKeys',
            'modules.sms.tokens',
        ]);
        expect(caught?.issues[0]).toEqual({
            message: 'секрет в TOML запрещён: удалите ключ и задайте переменную MARKET__MODULES__PAYMENTS__API_KEY',
            path: 'modules.payments.apiKey',
            source: 'config/default.toml',
        });
        expect(caught?.message).toContain('Секреты в TOML запрещены');
        expect(caught?.message).toContain('config/default.toml → modules.mail.secrets');
        expect(caught?.message).not.toContain(SECRET_VALUE);
    });
});

describe('ConfigLoader и секреты', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'market-config-secrets-'));
    const cleanDir = join(rootDir, 'clean');
    const dirtyDir = join(rootDir, 'dirty');
    mkdirSync(cleanDir);
    mkdirSync(dirtyDir);
    writeFileSync(join(cleanDir, 'default.toml'), '[modules.payments]\ncurrency = "AMD"\ntokenTtl = 900\n');
    writeFileSync(join(dirtyDir, 'default.toml'), '[modules.payments]\ncurrency = "AMD"\n');
    writeFileSync(join(dirtyDir, 'local.toml'), `[modules.payments]\napiKey = "${SECRET_VALUE}"\n`);

    const PAYMENTS = defineModuleConfig(
        'payments',
        z.strictObject({ apiKey: z.string().min(1), currency: z.string(), tokenTtl: z.number().int() }),
    );

    afterAll(() => {
        rmSync(rootDir, { recursive: true, force: true });
    });

    it('секрет в любом слое TOML прерывает загрузку с указанием файла и переменной, значение не раскрывается', () => {
        const loader = new ConfigLoader({ configDir: dirtyDir, dotenvPath: null, env: {} });
        expect(() => loader.load()).toThrow(ConfigSecretError);
        try {
            loader.load();
        } catch (error) {
            const { issues, message } = error as ConfigSecretError;
            expect(issues).toEqual([
                {
                    message:
                        'секрет в TOML запрещён: удалите ключ и задайте переменную APP__MODULES__PAYMENTS__API_KEY',
                    path: 'modules.payments.apiKey',
                    source: join(dirtyDir, 'local.toml'),
                },
            ]);
            expect(message).not.toContain(SECRET_VALUE);
        }
    });

    it('секрет из окружения допустим, попадает в дерево и раздел модуля, а маскирование его скрывает', () => {
        const env = { APP__MODULES__PAYMENTS__API_KEY: SECRET_VALUE };
        const config = new ConfigLoader({ configDir: cleanDir, dotenvPath: null, env }).load();
        expect((config.tree['modules'] as ConfigTree)['payments']).toEqual({
            apiKey: SECRET_VALUE,
            currency: 'AMD',
            tokenTtl: 900,
        });
        expect(JSON.stringify(maskSecrets(config.tree))).not.toContain(SECRET_VALUE);
        expect(JSON.stringify(config.layers)).not.toContain(SECRET_VALUE);

        const payments = loadModuleConfig(PAYMENTS, { configDir: cleanDir, dotenvPath: null, env });
        expect(payments.apiKey).toBe(SECRET_VALUE);
        expect(maskSecrets(payments)).toEqual({ apiKey: SECRET_MASK, currency: 'AMD', tokenTtl: 900 });
    });

    it('принимает свою политику секретов', () => {
        const permissive = new SecretPolicy([]);
        const config = new ConfigLoader({ configDir: dirtyDir, dotenvPath: null, env: {}, secrets: permissive }).load();
        expect((config.tree['modules'] as ConfigTree)['payments']).toMatchObject({ apiKey: SECRET_VALUE });
    });
});
