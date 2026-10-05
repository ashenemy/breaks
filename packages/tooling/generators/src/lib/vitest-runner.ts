import { spawn } from 'node:child_process';
import { join } from 'node:path';

import type { ExecutorContext } from '@nx/devkit';

import type { ProcessRunner, VitestExecutorSchema } from '../@types';
import { buildVitestArgs } from './vitest-args';

/** Executor `@market/tooling:vitest`: запускает Vitest проекта с переведёнными аргументами. */
export class VitestRunner {
    private readonly __run: ProcessRunner;

    constructor(run: ProcessRunner = spawnProcess) {
        this.__run = run;
    }

    public async execute(options: VitestExecutorSchema, context: ExecutorContext): Promise<{ success: boolean }> {
        const projectRoot = this.__resolveProjectRoot(context);
        const vitestBin = join(context.root, 'node_modules', 'vitest', 'vitest.mjs');
        const exitCode = await this.__run(process.execPath, [vitestBin, ...buildVitestArgs(options)], projectRoot);
        return { success: exitCode === 0 };
    }

    private __resolveProjectRoot(context: ExecutorContext): string {
        const projectName = context.projectName;
        const project = projectName ? context.projectsConfigurations.projects[projectName] : undefined;
        if (!project) {
            throw new Error(`Executor @market/tooling:vitest: проект не найден в контексте (${projectName ?? 'без имени'})`);
        }
        return join(context.root, project.root);
    }
}

function spawnProcess(command: string, args: string[], cwd: string): Promise<number> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd, stdio: 'inherit', env: { ...process.env, NX_DAEMON: 'false' } });
        child.on('error', reject);
        child.on('exit', (code) => resolve(code ?? 1));
    });
}
