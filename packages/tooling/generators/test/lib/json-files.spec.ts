import { describe, expect, it } from 'vitest';

import { listJsonFiles, reformatJsonFiles } from '../../src/lib/json-files';
import { createTsSolutionTree } from '../support/ts-solution-tree';

describe('listJsonFiles', () => {
    it('возвращает JSON-файлы каталога рекурсивно и по алфавиту', () => {
        const tree = createTsSolutionTree();
        tree.write('packages/core/x/project.json', '{}');
        tree.write('packages/core/x/nested/b.json', '{}');
        tree.write('packages/core/x/a.ts', 'export {};');
        expect(listJsonFiles(tree, 'packages/core/x')).toEqual([
            'packages/core/x/nested/b.json',
            'packages/core/x/project.json',
        ]);
    });
});

describe('reformatJsonFiles', () => {
    it('переписывает JSON с отступом в четыре пробела и пропускает отсутствующие файлы', () => {
        const tree = createTsSolutionTree();
        tree.write('packages/core/x/project.json', '{\n  "name": "x",\n  "tags": ["a"]\n}\n');
        reformatJsonFiles(tree, ['packages/core/x/project.json', 'packages/core/x/missing.json']);
        expect(tree.read('packages/core/x/project.json', 'utf-8')).toBe(
            '{\n    "name": "x",\n    "tags": [\n        "a"\n    ]\n}\n',
        );
        expect(tree.exists('packages/core/x/missing.json')).toBe(false);
    });
});
