import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { DEFAULT_RULES_PATH, loadRules, parseRules, RulesConfigError, RulesLoader } from '../../src/index.js';

const tempDir = mkdtempSync(join(tmpdir(), 'market-rules-'));

afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
});

describe('rules.toml воркспейса', () => {
    it('валиден и отражает конвенции', () => {
        const { config, filePath } = loadRules();
        expect(filePath).toBe(DEFAULT_RULES_PATH);
        expect(filePath.replace(/\\/g, '/')).toMatch(/packages\/tooling\/lint\/rules\.toml$/);
        expect(config.format.indent).toBe(4);
        expect(config.boundaries.constraints.length).toBeGreaterThanOrEqual(17);
        expect(config.boundaries.constraints[0]).toEqual({ source: 'platform:api', only: ['platform:api', 'platform:shared'] });
        expect(Object.keys(config.commits.types)).toEqual([
            'feat',
            'fix',
            'refactor',
            'test',
            'docs',
            'chore',
            'perf',
            'style',
            'security',
            'build',
            'db',
        ]);
        expect(config.commits.types['build']).toBe('🏗️');
        expect(config.platforms.web?.members?.['explicit-return-types']).toBe(false);
    });
});

describe('RulesLoader', () => {
    it('разбирает TOML и применяет умолчания', () => {
        const config = parseRules(`
[boundaries]
[[boundaries.constraints]]
source = "type:core"
only = ["type:core"]

[commits.types]
feat = "✨"
`);
        expect(config.format['line-width']).toBe(120);
        expect(config.boundaries['enforce-buildable']).toBe(true);
    });

    it('сообщает путь и причину ошибки валидации', () => {
        const toml = `
[format]
indent = 1

[boundaries]
[[boundaries.constraints]]
source = "type:core"
only = ["type:core"]

[commits.types]
feat = "✨"
`;
        expect(() => parseRules(toml, 'rules.toml')).toThrow(RulesConfigError);
        try {
            parseRules(toml, 'rules.toml');
        } catch (error) {
            const issue = (error as RulesConfigError).issues[0];
            expect(issue?.path).toBe('format.indent');
            expect((error as RulesConfigError).message).toContain('rules.toml');
            expect((error as RulesConfigError).message).toContain('format.indent');
        }
    });

    it('сообщает о синтаксической ошибке TOML одной строкой', () => {
        expect(() => parseRules('[format\nindent = 4')).toThrow(/синтаксис TOML: [^\n]+$/);
    });

    it('читает файл с диска и сообщает об отсутствующем файле', () => {
        const filePath = join(tempDir, 'rules.toml');
        writeFileSync(filePath, '[boundaries]\n[[boundaries.constraints]]\nsource = "type:core"\nonly = ["type:core"]\n[commits.types]\nfeat = "✨"\n');
        const loader = new RulesLoader(filePath);
        expect(loader.filePath).toBe(filePath);
        expect(loader.load().config.commits.types).toEqual({ feat: '✨' });

        expect(() => new RulesLoader(join(tempDir, 'missing.toml')).load()).toThrow(/файл не прочитан/);
    });
});
