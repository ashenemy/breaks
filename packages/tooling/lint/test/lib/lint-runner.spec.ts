import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import {
    buildEslintConfig,
    type Diagnostic,
    type EslintEngine,
    type EslintFileResult,
    formatLintReport,
    type LintReport,
    LintRunner,
    loadRules,
    type ProcessExecutor,
    type ProcessResult,
    parseBiomeReport,
    parseLintArgs,
    REPORT_RELATIVE,
} from '../../src/index.js';

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
const RULES_PATH = join(WORKSPACE_ROOT, 'packages', 'tooling', 'lint', 'rules.toml');
const tempRoots: string[] = [];

afterAll(() => {
    for (const root of tempRoots) {
        rmSync(root, { recursive: true, force: true });
    }
});

function createFixture(): string {
    mkdirSync(join(WORKSPACE_ROOT, 'tmp'), { recursive: true });
    const root = mkdtempSync(join(WORKSPACE_ROOT, 'tmp', 'lint-run-'));
    tempRoots.push(root);
    writeFileSync(join(root, 'biome.json'), '{}\n');
    writeFileSync(join(root, 'eslint.config.mjs'), 'export default [];\n');
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src', 'clean.ts'), 'export const OK: number = 1;\n');
    writeFileSync(join(root, 'src', 'dirty.ts'), 'export const BAD: any = 1;\n');
    writeFileSync(join(root, 'README.md'), '# fixture\n');
    return root;
}

type Call = { args: string[]; command: string };

function fakeExec(
    calls: Call[],
    biomeStdout = '{"diagnostics":[]}',
    gitFiles = ['src/clean.ts', 'src/dirty.ts', 'README.md'],
): ProcessExecutor {
    return (command, args): ProcessResult => {
        calls.push({ args, command });
        if (command === 'git') {
            return { status: 0, stderr: '', stdout: `${gitFiles.join('\n')}\n` };
        }
        return { status: 0, stderr: '', stdout: biomeStdout };
    };
}

function fakeEslint(
    messagesFor: (file: string) => EslintFileResult['messages'],
    fixed: string[] = [],
): (options: { cwd: string; fix: boolean }) => Promise<EslintEngine> {
    return async () => ({
        lintFiles: async (files) => files.map((filePath) => ({ filePath, messages: messagesFor(filePath) })),
        outputFixes: async (results) => {
            fixed.push(...results.map((result) => result.filePath));
        },
    });
}

const DIRTY_MESSAGE = (filePath: string): EslintFileResult['messages'] =>
    filePath.endsWith('dirty.ts')
        ? [{ line: 1, message: 'Unexpected any', ruleId: '@typescript-eslint/no-explicit-any', severity: 2 }]
        : [];

describe('parseLintArgs', () => {
    it('разбирает режимы и флаги', () => {
        expect(parseLintArgs(['--staged', '--fix'])).toEqual({ mode: 'staged', fix: true });
        expect(parseLintArgs(['--affected', '--ci', '--format-only'])).toEqual({
            mode: 'affected',
            ci: true,
            formatOnly: true,
        });
        expect(parseLintArgs(['--files', 'a.ts', 'b.ts'])).toEqual({ files: ['a.ts', 'b.ts'] });
        expect(parseLintArgs(['a.ts'])).toEqual({ files: ['a.ts'] });
        expect(parseLintArgs([])).toEqual({});
        expect(() => parseLintArgs(['--bogus'])).toThrow(/--bogus/);
    });
});

describe('parseBiomeReport', () => {
    it('переводит диагностики Biome в единый формат и терпим к мусору', () => {
        const stdout = `noise\n${JSON.stringify({
            diagnostics: [
                {
                    category: 'lint/suspicious/noExplicitAny',
                    message: 'Unexpected any.\nDetails',
                    severity: 'error',
                    location: { path: 'C:\\ws\\src\\a.ts', start: { line: 2 } },
                },
                {
                    category: 'format',
                    description: 'Formatter would have printed',
                    severity: 'warning',
                    location: { path: { file: 'src/b.ts' } },
                },
                { category: 'info', description: 'ignored', severity: 'information' },
            ],
        })}\ncheck ━━━ × Some errors`;
        expect(parseBiomeReport(stdout, 'C:\\ws')).toEqual([
            {
                file: 'src/a.ts',
                line: 2,
                message: 'Unexpected any.',
                rule: 'lint/suspicious/noExplicitAny',
                severity: 'error',
                tool: 'biome',
            },
            {
                file: 'src/b.ts',
                message: 'Formatter would have printed',
                rule: 'format',
                severity: 'warning',
                tool: 'biome',
            },
        ]);
        expect(parseBiomeReport('', 'C:\\ws')).toEqual([]);
        expect(parseBiomeReport('{broken', 'C:\\ws')).toEqual([]);
    });
});

describe('LintRunner: режимы, кэш, отчёт', () => {
    it('собирает файлы по режимам через git и фильтрует нелинтуемые', () => {
        const calls: Call[] = [];
        const root = createFixture();
        const runner = new LintRunner({ workspaceRoot: root, exec: fakeExec(calls), skipConfigs: true });
        expect(runner.collectFiles('staged')).toEqual(['src/clean.ts', 'src/dirty.ts']);
        expect(calls.at(-1)?.args).toEqual(['diff', '--cached', '--name-only', '--diff-filter=ACMR']);
        expect(runner.collectFiles('affected')).toEqual(['src/clean.ts', 'src/dirty.ts']);
        expect(calls.filter((call) => call.command === 'git').length).toBe(4);
        expect(runner.collectFiles('all', ['src/clean.ts', 'missing.ts', 'tmp/x.ts'])).toEqual(['src/clean.ts']);
    });

    it('объединяет диагностики Biome и ESLint, кэширует чистые файлы и пишет отчёт', async () => {
        const root = createFixture();
        const biome = JSON.stringify({
            diagnostics: [
                {
                    category: 'format',
                    description: 'Formatter would have printed',
                    severity: 'error',
                    location: { path: { file: 'src/dirty.ts' } },
                },
            ],
        });
        const calls: Call[] = [];
        const runner = new LintRunner({
            workspaceRoot: root,
            exec: fakeExec(calls, biome),
            createEslint: fakeEslint(DIRTY_MESSAGE),
            skipConfigs: true,
        });

        const first = await runner.run({ mode: 'staged' });
        expect(first.success).toBe(false);
        expect(first.errors).toBe(2);
        expect(first.files).toBe(2);
        expect(first.cachedFiles).toBe(0);
        expect(first.diagnostics.map((item: Diagnostic) => `${item.tool}:${item.file}`)).toEqual([
            'biome:src/dirty.ts',
            'eslint:src/dirty.ts',
        ]);
        expect(JSON.parse(readFileSync(join(root, REPORT_RELATIVE), 'utf8')).errors).toBe(2);
        expect(calls.find((call) => call.command !== 'git')?.args).toEqual(
            expect.arrayContaining(['check', '--reporter=json', 'src/clean.ts', 'src/dirty.ts']),
        );

        const second = await runner.run({ mode: 'staged' });
        expect(second.cachedFiles).toBe(1);
        expect(second.errors).toBe(2);

        writeFileSync(join(root, 'src', 'dirty.ts'), 'export const FIXED: number = 1;\n');
        const clean = new LintRunner({
            workspaceRoot: root,
            exec: fakeExec([], '{"diagnostics":[]}'),
            createEslint: fakeEslint(() => []),
            skipConfigs: true,
        });
        const third = await clean.run({ mode: 'staged' });
        expect(third.success).toBe(true);
        expect(third.cachedFiles).toBe(1);
        const fourth = await clean.run({ mode: 'staged' });
        expect(fourth.cachedFiles).toBe(2);
        expect(fourth.files).toBe(2);
    });

    it('в режиме ci предупреждения считаются ошибками, кэш и fix игнорируются', async () => {
        const root = createFixture();
        const calls: Call[] = [];
        const warn = (filePath: string): EslintFileResult['messages'] =>
            filePath.endsWith('clean.ts') ? [{ message: 'warn', ruleId: 'x', severity: 1 }] : [];
        const runner = new LintRunner({
            workspaceRoot: root,
            exec: fakeExec(calls),
            createEslint: fakeEslint(warn),
            skipConfigs: true,
        });
        const report = await runner.run({ ci: true, fix: true });
        expect(report.warnings).toBe(1);
        expect(report.success).toBe(false);
        expect(report.cachedFiles).toBe(0);
        expect(calls.find((call) => call.command !== 'git')?.args).not.toContain('--write');
    });

    it('--fix передаёт --write в Biome и применяет правки ESLint, --format-only пропускает линтеры', async () => {
        const root = createFixture();
        const calls: Call[] = [];
        const fixed: string[] = [];
        const runner = new LintRunner({
            workspaceRoot: root,
            exec: fakeExec(calls),
            createEslint: fakeEslint(() => [], fixed),
            skipConfigs: true,
        });
        await runner.run({ fix: true, files: ['src/dirty.ts'] });
        expect(calls.find((call) => call.command !== 'git')?.args).toContain('--write');
        expect(fixed.length).toBe(1);

        calls.length = 0;
        const formatOnly = await runner.run({ formatOnly: true, files: ['src/dirty.ts'], ci: true });
        expect(calls.find((call) => call.command !== 'git')?.args).toEqual(
            expect.arrayContaining(['--linter-enabled=false', '--assist-enabled=false']),
        );
        expect(formatOnly.diagnostics.filter((item) => item.tool === 'eslint')).toEqual([]);
    });

    it('перегенерирует конфиги из rules.toml перед запуском', async () => {
        const root = createFixture();
        rmSync(join(root, 'biome.json'));
        rmSync(join(root, 'eslint.config.mjs'));
        const runner = new LintRunner({ workspaceRoot: root, exec: fakeExec([]), createEslint: fakeEslint(() => []) });
        const report = await runner.run({ rulesPath: RULES_PATH, files: ['src/clean.ts'] });
        expect(report.configsRegenerated).toEqual(['biome.json', 'eslint.config.mjs']);
        expect(existsSync(join(root, 'biome.json'))).toBe(true);
        expect((await runner.run({ rulesPath: RULES_PATH, files: ['src/clean.ts'] })).configsRegenerated).toEqual([]);
    });

    it('форматирует текстовый отчёт', () => {
        const report: LintReport = {
            cachedFiles: 1,
            configsRegenerated: ['biome.json'],
            diagnostics: [
                {
                    file: 'src/a.ts',
                    line: 3,
                    message: 'Unexpected any',
                    rule: 'noExplicitAny',
                    severity: 'error',
                    tool: 'biome',
                },
            ],
            errors: 1,
            files: 2,
            mode: 'all',
            success: false,
            warnings: 0,
        };
        const text = formatLintReport(report);
        expect(text).toContain('ошибка  src/a.ts:3  noExplicitAny  Unexpected any');
        expect(text).toContain('Файлов: 2 (из кэша: 1), ошибок: 1, предупреждений: 0, перегенерированы: biome.json');
        expect(text).toContain('Линтинг не пройден.');
        expect(
            formatLintReport({ ...report, diagnostics: [], errors: 0, success: true, configsRegenerated: [] }),
        ).toContain('Линтинг пройден.');
    });
});

describe('LintRunner с настоящими Biome и ESLint', () => {
    it('находит нарушения в фикстуре и проходит на чистом файле', async () => {
        const root = createFixture();
        const { config } = loadRules(RULES_PATH);
        writeFileSync(join(root, 'eslint.config.mjs'), buildEslintConfig(config, { angular: false }));
        writeFileSync(
            join(root, 'biome.json'),
            JSON.stringify({
                linter: { rules: { suspicious: { noExplicitAny: 'error' } } },
                formatter: { indentStyle: 'space', indentWidth: 4 },
            }),
        );
        writeFileSync(join(root, 'src', 'dirty.ts'), 'export class Store {\n    private cache: any = 1;\n}\n');
        const runner = new LintRunner({ workspaceRoot: root, skipConfigs: true });
        const report = await runner.run({ files: ['src/clean.ts', 'src/dirty.ts'], ci: true });
        const rules = report.diagnostics.map((item) => item.rule);
        expect(rules).toContain('lint/suspicious/noExplicitAny');
        expect(rules).toContain('@typescript-eslint/naming-convention');
        expect(report.diagnostics.every((item) => item.file === 'src/dirty.ts')).toBe(true);
        expect(report.success).toBe(false);
    }, 120_000);
});
