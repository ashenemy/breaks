#!/usr/bin/env node
/**
 * CLI: `pnpm check:generated`. Строит граф проектов Nx и проверяет маркеры генераторов.
 * Код возврата 1, если найден проект без маркера.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findProjectsWithoutGenerator, formatReport } from './generated-projects.mjs';

const WORKSPACE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * @returns {Record<string, { name: string; data?: { root?: string; metadata?: { generator?: unknown } } }>}
 */
function readProjectGraphNodes() {
    const require = createRequire(import.meta.url);
    const tempDir = mkdtempSync(join(tmpdir(), 'market-generated-'));
    const graphFile = join(tempDir, 'graph.json');
    try {
        const result = spawnSync(process.execPath, [require.resolve('nx/bin/nx.js'), 'graph', `--file=${graphFile}`], {
            cwd: WORKSPACE_ROOT,
            encoding: 'utf8',
            env: { ...process.env, NX_DAEMON: 'false' },
        });
        if (result.status !== 0) {
            throw new Error(`nx graph завершился с кодом ${result.status}\n${result.stdout}\n${result.stderr}`);
        }
        return JSON.parse(readFileSync(graphFile, 'utf8')).graph.nodes;
    } finally {
        rmSync(tempDir, { recursive: true, force: true });
    }
}

const nodes = readProjectGraphNodes();
const missing = findProjectsWithoutGenerator(nodes);
console.log(formatReport(missing, Object.keys(nodes).length));
process.exitCode = missing.length === 0 ? 0 : 1;
