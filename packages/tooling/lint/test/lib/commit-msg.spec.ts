import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
    buildSubjectRegex,
    type CommitsRules,
    findProjectRoots,
    loadRules,
    projectRootOf,
    validateCommitMessage,
} from '../../src/index.js';

const { config } = loadRules();
const RULES: CommitsRules = config.commits;
const ROOTS = ['packages/tooling/lint', 'packages/tooling/generators', 'apps/api', 'modules/catalog/api'];
const tempRoots: string[] = [];

afterAll(() => {
    for (const root of tempRoots) {
        rmSync(root, { recursive: true, force: true });
    }
});

function message(subject: string, body = 'Task: E00.02.06\nSubstep: 1'): string {
    return `${subject}\n\n${body}\n`;
}

function errorsOf(subject: string, files: string[], body?: string): string[] {
    return validateCommitMessage({
        message: message(subject, body),
        projectRoots: ROOTS,
        rules: RULES,
        stagedFiles: files,
    }).errors;
}

describe('buildSubjectRegex', () => {
    it('собирает регулярное выражение из пар иконка-тип и root-scope', () => {
        const regex = buildSubjectRegex(RULES);
        expect(regex.test('✨ feat: packages/ui/ui-web: add button component')).toBe(true);
        expect(regex.test('🐛 fix: apps/api: handle expired OTP')).toBe(true);
        expect(regex.test('🔧 chore: root/ci: add affected pipeline')).toBe(true);
        expect(regex.test('feat: packages/ui/ui-web: add button')).toBe(false);
        expect(regex.test('✨ fix: packages/ui/ui-web: wrong icon')).toBe(false);
        expect(regex.test('✨ feat: libs/ui: unknown root scope')).toBe(false);
    });
});

describe('validateCommitMessage', () => {
    it('принимает корректное сообщение с файлами одного проекта', () => {
        const result = validateCommitMessage({
            message: message('✨ feat: packages/tooling/lint: add commit-msg validator'),
            projectRoots: ROOTS,
            rules: RULES,
            stagedFiles: [
                'packages/tooling/lint/src/lib/commit-msg.ts',
                'packages/tooling/lint/test/lib/commit-msg.spec.ts',
            ],
        });
        expect(result).toEqual({ errors: [], scope: 'packages/tooling/lint', type: 'feat', valid: true });
    });

    it('принимает корневые файлы со scope root/*', () => {
        expect(
            errorsOf('🔧 chore: root/workspace: pin versions', ['package.json', 'pnpm-lock.yaml', 'docs/x.md']),
        ).toEqual([]);
    });

    it('отклоняет неверный формат первой строки', () => {
        expect(errorsOf('add stuff', ['package.json'])[0]).toMatch(/Первая строка/);
        expect(errorsOf('feat: packages/tooling/lint: no icon', ['package.json'])[0]).toMatch(/Первая строка/);
    });

    it('проверяет пару иконка-тип и тип из списка', () => {
        expect(errorsOf('✨ fix: packages/tooling/lint: wrong icon', ['packages/tooling/lint/a.ts'])).toEqual([
            expect.stringContaining('не соответствует типу "fix"'),
        ]);
        expect(errorsOf('✨ wip: packages/tooling/lint: unknown', ['packages/tooling/lint/a.ts'])).toEqual([
            expect.stringContaining('Неизвестный тип коммита "wip"'),
        ]);
    });

    it('требует трейлеры Task и Substep', () => {
        const errors = errorsOf('✨ feat: packages/tooling/lint: x', ['packages/tooling/lint/a.ts'], 'no trailers');
        expect(errors).toEqual([expect.stringContaining('Task: <id>'), expect.stringContaining('Substep: <n>')]);
    });

    it('ограничивает длину сообщения', () => {
        const long = 'x'.repeat(RULES['subject-max'] + 1);
        expect(errorsOf(`✨ feat: packages/tooling/lint: ${long}`, ['packages/tooling/lint/a.ts'])).toEqual([
            expect.stringContaining('длиннее'),
        ]);
    });

    it('отклоняет файлы из нескольких проектов и смесь проекта с корнем', () => {
        expect(
            errorsOf('✨ feat: packages/tooling/lint: x', ['packages/tooling/lint/a.ts', 'apps/api/src/main.ts']),
        ).toEqual([expect.stringContaining('несколько проектов: apps/api, packages/tooling/lint')]);
        expect(errorsOf('✨ feat: packages/tooling/lint: x', ['packages/tooling/lint/a.ts', 'package.json'])).toEqual([
            expect.stringContaining('смешивает файлы проекта'),
        ]);
    });

    it('требует совпадения scope с корнем проекта', () => {
        expect(errorsOf('✨ feat: packages/tooling/generators: x', ['packages/tooling/lint/a.ts'])).toEqual([
            expect.stringContaining('не совпадает с корнем проекта "packages/tooling/lint"'),
        ]);
        expect(errorsOf('🔧 chore: root/workspace: x', ['packages/tooling/lint/a.ts'])).toEqual([
            expect.stringContaining('требуют scope "packages/tooling/lint"'),
        ]);
        expect(errorsOf('🔧 chore: packages/tooling/lint: x', ['package.json'])).toEqual([
            expect.stringContaining('Корневые файлы допустимы только со scope root/'),
        ]);
    });

    it('различает вложенные проекты по самому длинному корню', () => {
        expect(projectRootOf('modules/catalog/api/src/x.ts', ROOTS)).toBe('modules/catalog/api');
        expect(projectRootOf('modules/catalog/web/src/x.ts', ROOTS)).toBeNull();
        expect(projectRootOf('packages\\tooling\\lint\\a.ts', ROOTS)).toBe('packages/tooling/lint');
    });
});

describe('findProjectRoots', () => {
    it('находит каталоги с project.json, пропуская служебные', () => {
        const root = mkdtempSync(join(tmpdir(), 'market-roots-'));
        tempRoots.push(root);
        for (const dir of [
            'packages/core/ts-utils',
            'modules/catalog/api',
            'apps/api',
            'node_modules/x',
            'tmp/y',
            'packages/core/ts-utils/src/lib',
        ]) {
            mkdirSync(join(root, dir), { recursive: true });
        }
        for (const dir of ['packages/core/ts-utils', 'modules/catalog/api', 'apps/api', 'node_modules/x', 'tmp/y']) {
            writeFileSync(join(root, dir, 'project.json'), '{}');
        }
        expect(findProjectRoots(root)).toEqual(['apps/api', 'modules/catalog/api', 'packages/core/ts-utils']);
    });
});
