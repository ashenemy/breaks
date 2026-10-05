import { readJson, type Tree, visitNotIgnoredFiles, writeJson } from '@nx/devkit';

import { JSON_INDENT } from './constants';

/** Возвращает все JSON-файлы каталога (рекурсивно), кроме игнорируемых git. */
export function listJsonFiles(tree: Tree, directory: string): string[] {
    const files: string[] = [];
    visitNotIgnoredFiles(tree, directory, (filePath) => {
        if (filePath.endsWith('.json')) {
            files.push(filePath);
        }
    });
    return files.sort();
}

/** Перезаписывает JSON-файлы с отступом воркспейса: официальные генераторы Nx пишут два пробела. */
export function reformatJsonFiles(tree: Tree, filePaths: readonly string[]): void {
    for (const filePath of filePaths) {
        if (tree.exists(filePath)) {
            writeJson(tree, filePath, readJson(tree, filePath), { spaces: JSON_INDENT });
        }
    }
}
