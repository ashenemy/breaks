import {
    readProjectConfiguration,
    updateProjectConfiguration,
    type ProjectConfiguration,
    type Tree,
} from '@nx/devkit';

import type { GeneratedProjectMetadata } from '../@types';

/**
 * Записывает маркер «проект создан генератором» в `project.json` → `metadata`.
 * По нему CI отличает проекты, созданные генераторами, от собранных вручную (E00.01, раздел 2).
 */
export function markGeneratedProject(tree: Tree, projectName: string, metadata: GeneratedProjectMetadata): void {
    const configuration = readProjectConfiguration(tree, projectName);
    const merged = { ...configuration.metadata, ...metadata };
    updateProjectConfiguration(tree, projectName, {
        ...configuration,
        metadata: merged as ProjectConfiguration['metadata'],
    });
}

/** Читает маркер генератора проекта; `undefined`, если проект создан не генератором. */
export function readGeneratedProjectMetadata(tree: Tree, projectName: string): GeneratedProjectMetadata | undefined {
    const metadata: unknown = readProjectConfiguration(tree, projectName).metadata;
    if (typeof metadata !== 'object' || metadata === null || !('generator' in metadata)) {
        return undefined;
    }
    const { description, generator } = metadata as { description?: unknown; generator: unknown };
    if (typeof generator !== 'string') {
        return undefined;
    }
    return typeof description === 'string' ? { description, generator } : { generator };
}
