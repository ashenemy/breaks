import { join } from 'node:path';

import type { ExecutorContext } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

import { vitestExecutor } from '../../src/executors/vitest/executor';
import { VitestRunner } from '../../src/lib/vitest-runner';

type Call = { args: string[]; command: string; cwd: string };

function createContext(projectName = 'ts-utils'): ExecutorContext {
    return {
        cwd: '/workspace',
        isVerbose: false,
        nxJsonConfiguration: {},
        projectGraph: { nodes: {}, dependencies: {} },
        projectName,
        projectsConfigurations: {
            version: 2,
            projects: { 'ts-utils': { root: 'packages/core/ts-utils' } },
        },
        root: '/workspace',
    };
}

describe('VitestRunner', () => {
    it('запускает vitest воркспейса из каталога проекта с переведёнными аргументами', async () => {
        const calls: Call[] = [];
        const runner = new VitestRunner(async (command, args, cwd) => {
            calls.push({ args, command, cwd });
            return 0;
        });

        const result = await runner.execute({ testPathPattern: 'schema', coverage: true }, createContext());

        expect(result).toEqual({ success: true });
        expect(calls).toEqual([
            {
                args: [join('/workspace', 'node_modules', 'vitest', 'vitest.mjs'), 'run', 'schema', '--coverage'],
                command: process.execPath,
                cwd: join('/workspace', 'packages/core/ts-utils'),
            },
        ]);
    });

    it('возвращает неуспех при ненулевом коде Vitest', async () => {
        const runner = new VitestRunner(async () => 1);
        expect(await runner.execute({}, createContext())).toEqual({ success: false });
    });

    it('падает с понятной ошибкой, если проект не найден в контексте', async () => {
        const runner = new VitestRunner(async () => 0);
        await expect(runner.execute({}, createContext('missing'))).rejects.toThrow(/проект не найден/);
        await expect(runner.execute({}, { ...createContext(), projectName: undefined })).rejects.toThrow(/без имени/);
    });
});

describe('vitestExecutor на реальном проекте плагина', () => {
    it('выполняет тест по фильтру --testPathPattern и завершается успешно', async () => {
        const root = join(__dirname, '..', '..', '..', '..', '..');
        const context: ExecutorContext = {
            ...createContext('tooling-generators'),
            projectsConfigurations: {
                version: 2,
                projects: { 'tooling-generators': { root: 'packages/tooling/generators' } },
            },
            root,
        };
        const result = await vitestExecutor({ testPathPattern: 'naming', reporters: ['dot'] }, context);
        expect(result).toEqual({ success: true });
    }, 120_000);
});
