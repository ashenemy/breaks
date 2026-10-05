import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { findProjectsWithoutGenerator, formatReport, isGeneratorMarker } from './generated-projects.mjs';

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

type GraphNode = { name: string; data?: { root?: string; metadata?: { generator?: unknown } } };

function node(name: string, generator?: unknown): GraphNode {
    return { name, data: { root: `packages/core/${name}`, metadata: generator === undefined ? {} : { generator } } };
}

describe('isGeneratorMarker', () => {
    it.each(['@market/tooling:lib', '@nx/plugin:plugin', '@nx/js:library', 'local-plugin:app'])('принимает %s', (value) => {
        expect(isGeneratorMarker(value)).toBe(true);
    });

    it.each(['', 'lib', '@market/tooling', ':lib', 42, null, undefined, { generator: 'x' }])('отклоняет %j', (value) => {
        expect(isGeneratorMarker(value)).toBe(false);
    });
});

describe('findProjectsWithoutGenerator', () => {
    it('возвращает проекты без маркера по алфавиту', () => {
        const nodes = {
            zeta: node('zeta'),
            alpha: node('alpha', '@market/tooling:lib'),
            beta: node('beta', 'not-a-marker'),
            gamma: { name: 'gamma' },
        };
        expect(findProjectsWithoutGenerator(nodes)).toEqual([
            { name: 'beta', root: 'packages/core/beta' },
            { name: 'gamma', root: '' },
            { name: 'zeta', root: 'packages/core/zeta' },
        ]);
    });

    it('пустой список, когда все проекты помечены', () => {
        expect(findProjectsWithoutGenerator({ a: node('a', '@market/tooling:lib') })).toEqual([]);
    });
});

describe('formatReport', () => {
    it('сообщает об успехе', () => {
        expect(formatReport([], 3)).toContain('Все проекты (3) созданы генераторами');
    });

    it('перечисляет проекты без маркера и подсказывает генератор', () => {
        const report = formatReport([{ name: 'manual', root: 'packages/core/manual' }], 2);
        expect(report).toContain('(1 из 2)');
        expect(report).toContain('  - manual (packages/core/manual)');
        expect(report).toContain('nx g @market/tooling:<generator>');
    });
});

describe('pnpm check:generated на реальном воркспейсе', () => {
    it('все проекты воркспейса помечены генератором', () => {
        const result = spawnSync(process.execPath, [join(WORKSPACE_ROOT, 'tools', 'generated', 'check-generated-projects.mjs')], {
            cwd: WORKSPACE_ROOT,
            encoding: 'utf8',
            env: { ...process.env, NX_DAEMON: 'false' },
        });
        expect(result.stderr).toBe('');
        expect(result.stdout).toContain('созданы генераторами');
        expect(result.status).toBe(0);
    }, 120_000);
});
