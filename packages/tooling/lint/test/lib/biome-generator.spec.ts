import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { BiomeGenerator, buildBiomeConfig, computeConfigHash, detectBiomeVersion, HashCache, loadRules, RulesConfigError } from '../../src/index.js';

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const RULES_PATH = join(WORKSPACE_ROOT, 'packages', 'tooling', 'lint', 'rules.toml');
const tempRoots: string[] = [];

function createTempRoot(): string {
    const root = mkdtempSync(join(tmpdir(), 'market-biome-'));
    tempRoots.push(root);
    return root;
}

afterAll(() => {
    for (const root of tempRoots) {
        rmSync(root, { recursive: true, force: true });
    }
});

describe('buildBiomeConfig', () => {
    const { config: rules } = loadRules(RULES_PATH);

    it('переносит [format] в форматтер Biome', () => {
        const config = buildBiomeConfig(rules, '2.5.15');
        expect(config.$schema).toBe('https://biomejs.dev/schemas/2.5.15/schema.json');
        expect(config.formatter).toEqual({ enabled: true, indentStyle: 'space', indentWidth: 4, lineEnding: 'lf', lineWidth: 120 });
        expect(config.javascript.formatter).toEqual({ quoteStyle: 'single', trailingCommas: 'all' });
        expect(config.json.formatter.indentWidth).toBe(4);
        expect(config.vcs).toEqual({ clientKind: 'git', enabled: true, useIgnoreFile: true });
    });

    it('включает только правила из [overlap].biome и сортировку импортов', () => {
        const config = buildBiomeConfig(rules, '2.5.15');
        expect(config.linter.rules).toEqual({
            correctness: { noUnusedVariables: 'error' },
            style: { useExportType: 'error', useImportType: 'error' },
            suspicious: { noExplicitAny: 'error' },
        });
        expect(config.assist.actions.source.organizeImports).toBe('on');
    });

    it('учитывает уровень no-explicit-any и отключённую сортировку', () => {
        const custom = {
            ...rules,
            imports: { ...rules.imports, sort: false },
            overlap: { biome: ['noExplicitAny', 'organizeImports'], eslint: [] },
            types: { ...rules.types, 'no-explicit-any': 'warn' as const },
        };
        const config = buildBiomeConfig(custom, '2.5.15');
        expect(config.linter.rules).toEqual({ suspicious: { noExplicitAny: 'warn' } });
        expect(config.assist.actions.source.organizeImports).toBe('off');
    });

    it('отклоняет неизвестное правило Biome', () => {
        expect(() => buildBiomeConfig({ ...rules, overlap: { biome: ['noMagic'], eslint: [] } }, '2.5.15')).toThrow(/noMagic/);
    });
});

describe('computeConfigHash и HashCache', () => {
    it('меняется от текста правил и версий инструментов, не зависит от порядка версий', () => {
        const base = computeConfigHash('a = 1', { biome: '2.5.15', eslint: '10.12.0' });
        expect(base).toMatch(/^[0-9a-f]{64}$/);
        expect(computeConfigHash('a = 1', { eslint: '10.12.0', biome: '2.5.15' })).toBe(base);
        expect(computeConfigHash('a = 2', { biome: '2.5.15', eslint: '10.12.0' })).not.toBe(base);
        expect(computeConfigHash('a = 1', { biome: '2.6.0', eslint: '10.12.0' })).not.toBe(base);
    });

    it('хранит хеши по инструментам и терпим к повреждённому файлу', () => {
        const root = createTempRoot();
        const cache = new HashCache(root);
        expect(cache.read()).toEqual({});
        cache.write('biome', 'abc');
        cache.write('eslint', 'def');
        expect(cache.read()).toEqual({ biome: 'abc', eslint: 'def' });
        expect(cache.isFresh('biome', 'abc')).toBe(true);
        expect(cache.isFresh('biome', 'zzz')).toBe(false);
        expect(existsSync(`${cache.filePath}.${process.pid}.tmp`)).toBe(false);

        writeFileSync(cache.filePath, '{broken');
        expect(cache.read()).toEqual({});
        writeFileSync(cache.filePath, '{"biome": 5}');
        expect(cache.read()).toEqual({});
    });
});

describe('BiomeGenerator', () => {
    it('пишет biome.json, пропускает запись при свежем хеше и перегенерирует при изменении правил', () => {
        const root = createTempRoot();
        const rulesPath = join(root, 'rules.toml');
        writeFileSync(rulesPath, readFileSync(RULES_PATH, 'utf8'));

        const first = new BiomeGenerator({ workspaceRoot: root, rulesPath }, '2.5.15').generate();
        expect(first.written).toBe(true);
        expect(first.filePath).toBe(join(root, 'biome.json'));
        expect(JSON.parse(readFileSync(first.filePath, 'utf8'))).toEqual(first.config);
        expect(readFileSync(first.filePath, 'utf8')).toMatch(/^\{\n {4}"/);
        expect(new HashCache(root).read()['biome']).toBe(first.hash);

        const second = new BiomeGenerator({ workspaceRoot: root, rulesPath }, '2.5.15').generate();
        expect(second.written).toBe(false);
        expect(second.hash).toBe(first.hash);

        expect(new BiomeGenerator({ workspaceRoot: root, rulesPath, force: true }, '2.5.15').generate().written).toBe(true);

        rmSync(first.filePath);
        expect(new BiomeGenerator({ workspaceRoot: root, rulesPath }, '2.5.15').generate().written).toBe(true);

        writeFileSync(rulesPath, readFileSync(RULES_PATH, 'utf8').replace('indent = 4', 'indent = 2'));
        const third = new BiomeGenerator({ workspaceRoot: root, rulesPath }, '2.5.15').generate();
        expect(third.written).toBe(true);
        expect(third.hash).not.toBe(first.hash);
        expect(third.config.formatter.indentWidth).toBe(2);

        expect(new BiomeGenerator({ workspaceRoot: root, rulesPath }, '2.6.0').generate().written).toBe(true);
    });

    it('падает на некорректных правилах, не трогая файл', () => {
        const root = createTempRoot();
        const rulesPath = join(root, 'rules.toml');
        writeFileSync(rulesPath, '[format]\nindent = 1\n');
        expect(() => new BiomeGenerator({ workspaceRoot: root, rulesPath }, '2.5.15').generate()).toThrow(RulesConfigError);
        expect(existsSync(join(root, 'biome.json'))).toBe(false);
    });

    it('берёт версию Biome из установленного пакета', () => {
        expect(detectBiomeVersion(WORKSPACE_ROOT)).toMatch(/^2\.\d+\.\d+$/);
        expect(() => detectBiomeVersion(createTempRoot())).toThrow();
    });

    it('сгенерированный конфиг принимает установленный Biome', () => {
        const root = createTempRoot();
        const rulesPath = join(root, 'rules.toml');
        writeFileSync(rulesPath, readFileSync(RULES_PATH, 'utf8'));
        new BiomeGenerator({ workspaceRoot: root, rulesPath }, detectBiomeVersion(WORKSPACE_ROOT)).generate();
        mkdirSync(join(root, 'src'));
        writeFileSync(join(root, 'src', 'sample.ts'), "export function sample(value: any): string {\n    return String(value);\n}\n");

        const biomeBin = join(WORKSPACE_ROOT, 'node_modules', '@biomejs', 'biome', 'bin', 'biome');
        const result = spawnSync(process.execPath, [biomeBin, 'lint', '--vcs-enabled=false', 'src/sample.ts'], { cwd: root, encoding: 'utf8' });
        expect(result.stdout + result.stderr).toContain('noExplicitAny');
        expect(result.status).toBe(1);
    }, 60_000);
});
