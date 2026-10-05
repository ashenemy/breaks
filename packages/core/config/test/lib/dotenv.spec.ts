import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { ConfigError, DotenvFile, mergeEnv } from '../../src/index.js';

const tempDir = mkdtempSync(join(tmpdir(), 'market-config-dotenv-'));

afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
});

describe('DotenvFile', () => {
    it('читает переменные файла, понимая комментарии, кавычки и export', () => {
        const filePath = join(tempDir, '.env');
        writeFileSync(
            filePath,
            '# секреты локальной разработки\nAPP__MODULES__PAYMENTS__API_KEY=sk_test_123\nexport APP_ENV=test\nQUOTED="with space"\n',
        );
        const file = new DotenvFile(filePath);
        expect(file.filePath).toBe(filePath);
        expect(file.exists()).toBe(true);
        expect(file.info()).toEqual({ name: 'dotenv', present: true, source: filePath });
        expect(file.read()).toEqual({
            APP__MODULES__PAYMENTS__API_KEY: 'sk_test_123',
            APP_ENV: 'test',
            QUOTED: 'with space',
        });
    });

    it('отсутствующий файл даёт пустой словарь и present = false', () => {
        const file = new DotenvFile(join(tempDir, 'missing.env'));
        expect(file.exists()).toBe(false);
        expect(file.info().present).toBe(false);
        expect(file.read()).toEqual({});
    });

    it('каталог вместо файла даёт ConfigError с источником', () => {
        const file = new DotenvFile(tempDir);
        expect(() => file.read()).toThrow(ConfigError);
        expect(() => file.read()).toThrow(/файл не прочитан/);
    });
});

describe('mergeEnv', () => {
    it('переменные процесса сильнее .env, undefined отбрасывается, входы не изменяются', () => {
        const dotenv = { A: 'file', B: 'file' };
        const processEnv = { B: 'process', C: 'process', D: undefined };
        expect(mergeEnv(dotenv, processEnv)).toEqual({ A: 'file', B: 'process', C: 'process' });
        expect(dotenv).toEqual({ A: 'file', B: 'file' });
    });
});
