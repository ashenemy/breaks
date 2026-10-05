import { spawnSync } from 'node:child_process';

import { HookInstaller, type HookName, type HookOutcome, HookRunner } from '../lib/hooks.js';
import type { ProcessExecutor } from '../lib/lint-runner.js';

const exec: ProcessExecutor = (command, args, cwd) => {
    const result = spawnSync(command, args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, NX_DAEMON: 'false' },
    });
    return { status: result.status ?? 1, stderr: result.stderr ?? '', stdout: result.stdout ?? '' };
};

async function dispatch(hook: string | undefined, args: string[], workspaceRoot: string): Promise<HookOutcome> {
    const runner = new HookRunner({ exec, workspaceRoot });
    switch (hook as HookName | 'install' | undefined) {
        case 'install':
            return new HookInstaller(workspaceRoot, exec).install();
        case 'pre-commit':
            return runner.preCommit();
        case 'commit-msg': {
            const [messageFile] = args;
            if (!messageFile) {
                return { exitCode: 2, output: 'commit-msg: не передан путь к файлу сообщения' };
            }
            return runner.commitMsg(messageFile);
        }
        case 'pre-push':
            return runner.prePush();
        default:
            return {
                exitCode: 2,
                output: `Неизвестный хук: ${hook ?? '<пусто>'}; ожидается install | pre-commit | commit-msg | pre-push`,
            };
    }
}

dispatch(process.argv[2], process.argv.slice(3), process.cwd()).then(
    (outcome) => {
        console.log(outcome.output);
        process.exitCode = outcome.exitCode;
    },
    (error: unknown) => {
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 2;
    },
);
