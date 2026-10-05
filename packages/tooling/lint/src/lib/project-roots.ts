import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const SKIPPED_DIRECTORIES = new Set([
    'node_modules',
    'dist',
    '.git',
    '.nx',
    'tmp',
    'coverage',
    'test-output',
    'out-tsc',
]);

/** Корни проектов Nx (каталоги с `project.json`), относительно воркспейса, с прямыми слэшами. */
export function findProjectRoots(workspaceRoot: string): string[] {
    const roots: string[] = [];
    const visit = (relativeDir: string): void => {
        const absolute = join(workspaceRoot, relativeDir);
        for (const entry of readdirSync(absolute, { withFileTypes: true })) {
            if (!entry.isDirectory() || SKIPPED_DIRECTORIES.has(entry.name) || entry.name.startsWith('.')) {
                continue;
            }
            const child = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
            if (existsSync(join(workspaceRoot, child, 'project.json'))) {
                roots.push(child);
            } else {
                visit(child);
            }
        }
    };
    visit('');
    return roots.sort();
}

/** Проект файла: самый длинный корень-префикс; `null` для корневых файлов воркспейса. */
export function projectRootOf(file: string, projectRoots: readonly string[]): string | null {
    const normalized = file.replace(/\\/g, '/');
    let match: string | null = null;
    for (const root of projectRoots) {
        if (
            (normalized === root || normalized.startsWith(`${root}/`)) &&
            (match === null || root.length > match.length)
        ) {
            match = root;
        }
    }
    return match;
}
