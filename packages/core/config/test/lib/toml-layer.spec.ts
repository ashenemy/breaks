import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { ConfigError, TomlLayer } from '../../src/index.js';

const tempDir = mkdtempSync(join(tmpdir(), 'market-config-layer-'));

afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
});

describe('TomlLayer', () => {
    it('читает существующий файл и сообщает о присутствии слоя', () => {
        const filePath = join(tempDir, 'default.toml');
        writeFileSync(filePath, '[modules.catalog]\npageSize = 20\nenabled = true\ntags = ["a", "b"]\n');
        const layer = new TomlLayer('default', filePath);
        expect(layer.name).toBe('default');
        expect(layer.filePath).toBe(filePath);
        expect(layer.exists()).toBe(true);
        expect(layer.load()).toEqual({
            info: { name: 'default', present: true, source: filePath },
            tree: { modules: { catalog: { pageSize: 20, enabled: true, tags: ['a', 'b'] } } },
        });
    });

    it('отсутствующий файл даёт пустое дерево и present = false', () => {
        const filePath = join(tempDir, 'staging.toml');
        const layer = new TomlLayer('staging', filePath);
        expect(layer.exists()).toBe(false);
        expect(layer.load()).toEqual({ info: { name: 'staging', present: false, source: filePath }, tree: {} });
    });

    it('ошибка разбора превращается в ConfigError с путём файла и одной строкой причины', () => {
        const filePath = join(tempDir, 'local.toml');
        writeFileSync(filePath, '[modules.catalog\npageSize = 20\n');
        const layer = new TomlLayer('local', filePath);
        expect(() => layer.load()).toThrow(ConfigError);
        try {
            layer.load();
        } catch (error) {
            const { issues, message } = error as ConfigError;
            expect(issues).toHaveLength(1);
            expect(issues[0]?.source).toBe(filePath);
            expect(issues[0]?.path).toBe('');
            expect(issues[0]?.message).toMatch(/^разбор TOML: [^\n]+$/);
            expect(message).toContain(filePath);
        }
    });

    it('отвергает небезопасные ключи __proto__ и constructor до слияния', () => {
        expect(() => TomlLayer.parse('[__proto__]\npolluted = true\n', 'x.toml')).toThrow(ConfigError);
        expect(() => TomlLayer.parse('constructor = 1\n', 'x.toml')).toThrow(/x\.toml: разбор TOML/);
        expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
    });

    it('целые числа остаются number, даты — Date', () => {
        const tree = TomlLayer.parse('big = 9007199254740991\nwhen = 2026-10-05T10:00:00Z\n', '<inline>');
        expect(tree['big']).toBe(9007199254740991);
        expect(tree['when']).toBeInstanceOf(Date);
    });

    it('каталог вместо файла даёт ошибку чтения с источником', () => {
        const layer = new TomlLayer('dev', tempDir);
        expect(() => layer.load()).toThrow(/файл не прочитан/);
    });

    it('статический parse разбирает текст с указанным источником', () => {
        expect(TomlLayer.parse('a = 1', '<inline>')).toEqual({ a: 1 });
        expect(() => TomlLayer.parse('a =', '<inline>')).toThrow(/<inline>: разбор TOML/);
    });
});
