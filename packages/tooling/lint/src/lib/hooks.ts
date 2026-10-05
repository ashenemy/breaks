import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { type CommitValidationResult, validateCommitMessage } from './commit-msg.js';
import {
    formatLintReport,
    type LintReport,
    LintRunner,
    type ProcessExecutor,
    type ProcessResult,
} from './lint-runner.js';
import { findProjectRoots } from './project-roots.js';
import { DEFAULT_RULES_PATH, RulesLoader } from './rules-loader.js';

export type HookName = 'commit-msg' | 'pre-commit' | 'pre-push';

export const HOOKS_DIRECTORY = '.githooks';

export type HookDependencies = {
    exec: ProcessExecutor;
    /** Фабрика раннера: подменяется в тестах. */
    runLint?: (options: { fix: boolean; mode: 'staged' }) => Promise<LintReport>;
    rulesPath?: string;
    workspaceRoot: string;
};

export type HookOutcome = {
    exitCode: number;
    output: string;
};

/** Регистрация хуков: `git config core.hooksPath .githooks`; пропускается в CI и вне git-репозитория. */
export class HookInstaller {
    private readonly __exec: ProcessExecutor;

    private readonly __root: string;

    constructor(workspaceRoot: string, exec: ProcessExecutor) {
        this.__root = workspaceRoot;
        this.__exec = exec;
    }

    public install(env: NodeJS.ProcessEnv = process.env): HookOutcome {
        if (env['CI'] === 'true') {
            return { exitCode: 0, output: 'CI: хуки git не устанавливаются.' };
        }
        if (!existsSync(join(this.__root, '.git'))) {
            return { exitCode: 0, output: 'Не git-репозиторий: хуки не устанавливаются.' };
        }
        const result = this.__exec('git', ['config', 'core.hooksPath', HOOKS_DIRECTORY], this.__root);
        return result.status === 0
            ? { exitCode: 0, output: `Хуки git: core.hooksPath = ${HOOKS_DIRECTORY}` }
            : { exitCode: 1, output: `Не удалось настроить core.hooksPath: ${result.stderr}` };
    }
}

/** Логика хуков git; скрипты в `.githooks/` лишь вызывают её. */
export class HookRunner {
    private readonly __dependencies: HookDependencies;

    constructor(dependencies: HookDependencies) {
        this.__dependencies = dependencies;
    }

    /** pre-commit: линтинг и автоисправление застейдженных файлов, затем их повторное добавление в индекс. */
    public async preCommit(): Promise<HookOutcome> {
        const staged = this.__stagedFiles();
        if (staged.length === 0) {
            return { exitCode: 0, output: 'pre-commit: нет файлов для проверки.' };
        }
        const report = await this.__runLint({ fix: true, mode: 'staged' });
        const addResult = this.__dependencies.exec('git', ['add', '--', ...staged], this.__dependencies.workspaceRoot);
        const output = [formatLintReport(report), addResult.status === 0 ? '' : `git add: ${addResult.stderr}`]
            .filter(Boolean)
            .join('\n');
        return { exitCode: report.success && addResult.status === 0 ? 0 : 1, output };
    }

    /** commit-msg: формат сообщения и принадлежность файлов одному проекту. */
    public commitMsg(messageFile: string): HookOutcome {
        const message = readFileSync(messageFile, 'utf8');
        const result = this.validateMessage(message, this.__stagedFiles());
        return {
            exitCode: result.valid ? 0 : 1,
            output: result.valid
                ? `commit-msg: ok (${result.type}, ${result.scope})`
                : `commit-msg: сообщение отклонено:\n${result.errors.map((error) => `  - ${error}`).join('\n')}`,
        };
    }

    public validateMessage(message: string, stagedFiles: readonly string[]): CommitValidationResult {
        const { config } = new RulesLoader(this.__dependencies.rulesPath ?? DEFAULT_RULES_PATH).load();
        return validateCommitMessage({
            message,
            projectRoots: findProjectRoots(this.__dependencies.workspaceRoot),
            rules: config.commits,
            stagedFiles,
        });
    }

    /** pre-push: типизация и тесты затронутых проектов. */
    public prePush(): HookOutcome {
        const result = this.__nx(['affected', '-t', 'typecheck', 'test', '--base=origin/main', '--head=HEAD']);
        return {
            exitCode: result.status === 0 ? 0 : 1,
            output:
                result.status === 0
                    ? 'pre-push: typecheck и test затронутых проектов пройдены.'
                    : `pre-push: проверки не пройдены.\n${result.stdout}\n${result.stderr}`,
        };
    }

    private __runLint(options: { fix: boolean; mode: 'staged' }): Promise<LintReport> {
        if (this.__dependencies.runLint) {
            return this.__dependencies.runLint(options);
        }
        return new LintRunner({ workspaceRoot: this.__dependencies.workspaceRoot, exec: this.__dependencies.exec }).run(
            {
                ...options,
                rulesPath: this.__dependencies.rulesPath,
            },
        );
    }

    private __stagedFiles(): string[] {
        const result = this.__dependencies.exec(
            'git',
            ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
            this.__dependencies.workspaceRoot,
        );
        return result.stdout
            .split('\n')
            .map((line) => line.trim().replace(/\\/g, '/'))
            .filter((line) => line.length > 0);
    }

    private __nx(args: string[]): ProcessResult {
        const nxBin = join(this.__dependencies.workspaceRoot, 'node_modules', 'nx', 'dist', 'bin', 'nx.js');
        return this.__dependencies.exec(process.execPath, [nxBin, ...args], this.__dependencies.workspaceRoot);
    }
}
