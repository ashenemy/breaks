import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CliRun, RunnerReport, ViolationFixture } from '../src/@types/index.js';
import { CLEAN_FIXTURES, VIOLATION_FIXTURES } from '../src/lib/fixtures.js';

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CLI = join(WORKSPACE_ROOT, 'packages', 'tooling', 'lint', 'dist', 'cli', 'lint-run.js');
const REPORT = join('.cache', 'lint', 'report.json');

let fixtureRoot = '';

function writeFixtures(root: string, fixtures: readonly ViolationFixture[]): string[] {
    return fixtures.map((fixture) => {
        const filePath = join(root, fixture.file);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, fixture.content);
        return fixture.file;
    });
}

function runCli(root: string, args: string[]): CliRun {
    const result = spawnSync(process.execPath, [CLI, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, NX_DAEMON: 'false' },
    });
    const reportPath = join(root, REPORT);
    const report: RunnerReport = existsSync(reportPath)
        ? (JSON.parse(readFileSync(reportPath, 'utf8')) as RunnerReport)
        : { cachedFiles: 0, configsRegenerated: [], diagnostics: [], errors: 0, files: 0, success: false, warnings: 0 };
    return { report, status: result.status ?? -1, stdout: `${result.stdout}\n${result.stderr}` };
}

describe('E2E раннера lint:run', () => {
    let violations: CliRun;

    beforeAll(() => {
        if (!existsSync(CLI)) {
            throw new Error(`Сначала соберите пакет: nx run tooling-lint:build (нет ${CLI})`);
        }
        mkdirSync(join(WORKSPACE_ROOT, 'tmp'), { recursive: true });
        fixtureRoot = mkdtempSync(join(WORKSPACE_ROOT, 'tmp', 'lint-e2e-'));
        const files = writeFixtures(fixtureRoot, [...VIOLATION_FIXTURES, ...CLEAN_FIXTURES]);
        violations = runCli(fixtureRoot, ['--ci', '--files', ...files]);
    }, 180_000);

    afterAll(() => {
        if (fixtureRoot) {
            rmSync(fixtureRoot, { recursive: true, force: true });
        }
    });

    it('генерирует конфиги из rules.toml и завершается кодом 1 при нарушениях', () => {
        expect(violations.report.configsRegenerated).toEqual(['biome.json', 'eslint.config.mjs']);
        expect(existsSync(join(fixtureRoot, 'biome.json'))).toBe(true);
        expect(existsSync(join(fixtureRoot, 'eslint.config.mjs'))).toBe(true);
        expect(violations.status).toBe(1);
        expect(violations.report.success).toBe(false);
        expect(violations.stdout).toContain('Линтинг не пройден.');
    });

    it.each(VIOLATION_FIXTURES.map((fixture) => [fixture.name, fixture] as const))(
        'отклоняет: %s',
        (_name, fixture) => {
            const rules = violations.report.diagnostics
                .filter((item) => item.file === fixture.file)
                .map((item) => item.rule);
            for (const expected of fixture.expectedRules) {
                expect(rules, `${fixture.rule} → ${fixture.file}`).toContain(expected);
            }
        },
    );

    it.each(CLEAN_FIXTURES.map((fixture) => [fixture.name, fixture] as const))('пропускает: %s', (_name, fixture) => {
        expect(violations.report.diagnostics.filter((item) => item.file === fixture.file)).toEqual([]);
    });

    it('покрывает каждое правило из E00.02 хотя бы одной фикстурой', () => {
        const covered = new Set(VIOLATION_FIXTURES.map((fixture) => fixture.rule.split(':')[0]));
        for (const rule of [
            'format',
            'consistent-type-definitions',
            'consistent-type-imports',
            'no-explicit-any',
            'naming',
            'member-ordering',
            'explicit-member-accessibility',
            'explicit-function-return-type',
            'typedef',
            'no-default-export',
            'no-export-all',
            'angular',
        ]) {
            expect(covered.has(rule), rule).toBe(true);
        }
    });

    it('--fix исправляет форматирование и import type, после чего чистые файлы проходят с кодом 0', () => {
        const fixable = [...VIOLATION_FIXTURES].filter(
            (fixture) => fixture.rule === 'format' || fixture.rule === 'consistent-type-imports',
        );
        const files = fixable.map((fixture) => fixture.file);
        const fixed = runCli(fixtureRoot, ['--fix', '--files', ...files]);
        expect(fixed.status).toBe(0);
        expect(readFileSync(join(fixtureRoot, files[0] ?? ''), 'utf8')).toContain("    return 'hi ' + name;");
        expect(readFileSync(join(fixtureRoot, files[1] ?? ''), 'utf8')).toContain('import type { Shape }');

        const rerun = runCli(fixtureRoot, ['--ci', '--files', ...files]);
        expect(rerun.status).toBe(0);
        expect(rerun.report.diagnostics).toEqual([]);
        expect(rerun.stdout).toContain('Линтинг пройден.');
    }, 120_000);

    it('отвергает неизвестный аргумент кодом 2', () => {
        expect(runCli(fixtureRoot, ['--bogus']).status).toBe(2);
    });
});
