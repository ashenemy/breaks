import { readProjectConfiguration } from '@nx/devkit';
import { describe, expect, it } from 'vitest';

import { markGeneratedProject, readGeneratedProjectMetadata } from '../../src/lib/project-marker';
import { createTsSolutionTree } from '../support/ts-solution-tree';

function createProject(): ReturnType<typeof createTsSolutionTree> {
    const tree = createTsSolutionTree();
    tree.write(
        'packages/core/manual/project.json',
        JSON.stringify({ name: 'manual', root: 'packages/core/manual', metadata: { description: 'Вручную' } }),
    );
    return tree;
}

describe('маркер генератора в project.json', () => {
    it('отсутствует у проекта, созданного вручную', () => {
        expect(readGeneratedProjectMetadata(createProject(), 'manual')).toBeUndefined();
    });

    it('игнорирует маркер неверного типа', () => {
        const tree = createTsSolutionTree();
        tree.write(
            'packages/core/odd/project.json',
            JSON.stringify({ name: 'odd', root: 'packages/core/odd', metadata: { generator: 42, description: 7 } }),
        );
        expect(readGeneratedProjectMetadata(tree, 'odd')).toBeUndefined();
    });

    it('возвращает только generator, если описание не строка', () => {
        const tree = createTsSolutionTree();
        tree.write(
            'packages/core/bare/project.json',
            JSON.stringify({
                name: 'bare',
                root: 'packages/core/bare',
                metadata: { generator: '@market/tooling:lib', description: 7 },
            }),
        );
        expect(readGeneratedProjectMetadata(tree, 'bare')).toEqual({ generator: '@market/tooling:lib' });
    });

    it('записывается в metadata, сохраняя существующие поля', () => {
        const tree = createProject();
        markGeneratedProject(tree, 'manual', { generator: '@market/tooling:lib' });
        expect(readGeneratedProjectMetadata(tree, 'manual')).toEqual({
            description: 'Вручную',
            generator: '@market/tooling:lib',
        });
        expect(readProjectConfiguration(tree, 'manual').metadata?.description).toBe('Вручную');
    });
});
