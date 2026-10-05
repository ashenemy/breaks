import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
    DEFAULT_RULES_PATH,
    HookInstaller,
    HookRunner,
    type LintReport,
    type ProcessExecutor,
    type ProcessResult,
} from '../../src/index.js';

type Call = { args: string[]; command: string };
const tempRoots: string[] = [];

afterAll(() => {
    for (const root of tempRoots) {
        rmSync(root, { recursive: true, force: true });
    }
});

function createRepo(withGit = true): string {
    const root = mkdtempSync(join(tmpdir(), 'market-hooks-'));
    tempRoots.push(root);
    if (withGit) {
        mkdirSync(join(root, '.git'));
    }
    mkdirSync(join(root, 'packages', 'tooling', 'lint'), { recursive: true });
    writeFileSync(join(root, 'packages', 'tooling', 'lint', 'project.json'), '{}');
    return root;
}

function exec(calls: Call[], staged: string[] = [], failing: string[] = []): ProcessExecutor {
    return (command, args): ProcessResult => {
        calls.push({ args, command });
        const key = `${command} ${args[0] ?? ''}`.trim();
        if (failing.some((item) => key.startsWith(item))) {
            return { status: 1, stderr: 'boom', stdout: '' };
        }
        if (command === 'git' && args[0] === 'diff') {
            return { status: 0, stderr: '', stdout: `${staged.join('\n')}\n` };
        }
        return { status: 0, stderr: '', stdout: '' };
    };
}

function report(success: boolean): LintReport {
    return {
        cachedFiles: 0,
        configsRegenerated: [],
        diagnostics: [],
        errors: success ? 0 : 1,
        files: 1,
        mode: 'staged',
        success,
        warnings: 0,
    };
}

describe('HookInstaller', () => {
    it('настраивает core.hooksPath в git-репозитории и пропускает CI и не-репозитории', () => {
        const calls: Call[] = [];
        const root = createRepo();
        expect(new HookInstaller(root, exec(calls)).install({})).toEqual({
            exitCode: 0,
            output: 'Хуки git: core.hooksPath = .githooks',
        });
        expect(calls).toEqual([{ args: ['config', 'core.hooksPath', '.githooks'], command: 'git' }]);

        expect(new HookInstaller(root, exec([])).install({ CI: 'true' }).output).toMatch(/CI/);
        expect(new HookInstaller(createRepo(false), exec([])).install({}).output).toMatch(/Не git-репозиторий/);
        expect(new HookInstaller(root, exec([], [], ['git config'])).install({}).exitCode).toBe(1);
    });
});

describe('HookRunner', () => {
    it('pre-commit: линтит с автоисправлением и возвращает файлы в индекс', async () => {
        const calls: Call[] = [];
        const root = createRepo();
        const staged = ['packages/tooling/lint/a.ts'];
        const lintCalls: { fix: boolean; mode: string }[] = [];
        const runner = new HookRunner({
            exec: exec(calls, staged),
            runLint: async (options) => {
                lintCalls.push(options);
                return report(true);
            },
            rulesPath: DEFAULT_RULES_PATH,
            workspaceRoot: root,
        });
        const outcome = await runner.preCommit();
        expect(outcome.exitCode).toBe(0);
        expect(lintCalls).toEqual([{ fix: true, mode: 'staged' }]);
        expect(calls.at(-1)).toEqual({ args: ['add', '--', 'packages/tooling/lint/a.ts'], command: 'git' });
    });

    it('pre-commit: пустой индекс пропускается, ошибки линтинга останавливают коммит', async () => {
        const root = createRepo();
        const empty = new HookRunner({ exec: exec([], []), runLint: async () => report(true), workspaceRoot: root });
        expect((await empty.preCommit()).exitCode).toBe(0);

        const failing = new HookRunner({
            exec: exec([], ['packages/tooling/lint/a.ts']),
            runLint: async () => report(false),
            workspaceRoot: root,
        });
        expect((await failing.preCommit()).exitCode).toBe(1);
    });

    it('commit-msg: принимает корректное сообщение и отклоняет неверное', () => {
        const root = createRepo();
        const messageFile = join(root, 'COMMIT_EDITMSG');
        const runner = new HookRunner({
            exec: exec([], ['packages/tooling/lint/a.ts']),
            rulesPath: DEFAULT_RULES_PATH,
            workspaceRoot: root,
        });

        writeFileSync(messageFile, '✨ feat: packages/tooling/lint: add hooks\n\nTask: E00.02.05\nSubstep: 1\n');
        expect(runner.commitMsg(messageFile)).toEqual({
            exitCode: 0,
            output: 'commit-msg: ok (feat, packages/tooling/lint)',
        });

        writeFileSync(messageFile, 'bad message\n');
        const rejected = runner.commitMsg(messageFile);
        expect(rejected.exitCode).toBe(1);
        expect(rejected.output).toContain('сообщение отклонено');
    });

    it('pre-push: запускает typecheck и test затронутых проектов через nx', () => {
        const calls: Call[] = [];
        const root = createRepo();
        const runner = new HookRunner({ exec: exec(calls), workspaceRoot: root });
        expect(runner.prePush().exitCode).toBe(0);
        expect(calls[0]?.command).toBe(process.execPath);
        expect(calls[0]?.args.slice(1)).toEqual([
            'affected',
            '-t',
            'typecheck',
            'test',
            '--base=origin/main',
            '--head=HEAD',
        ]);

        const failing = new HookRunner({ exec: exec([], [], [process.execPath]), workspaceRoot: root });
        expect(failing.prePush().exitCode).toBe(1);
    });
});
