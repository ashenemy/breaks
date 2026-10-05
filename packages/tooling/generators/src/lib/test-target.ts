import { readProjectConfiguration, type TargetConfiguration, type Tree, updateProjectConfiguration } from '@nx/devkit';

import { VITEST_EXECUTOR } from './constants';

/**
 * Явная цель `test` на executor-е воркспейса вместо выведенной `@nx/vitest`: приёмочные команды эпиков
 * используют флаги в стиле Jest (`--testPathPattern`), которые сам Vitest отвергает.
 * Кэш и inputs приходят из `targetDefaults.test` в `nx.json`.
 */
export function buildVitestTestTarget(): TargetConfiguration {
    return {
        executor: VITEST_EXECUTOR,
        outputs: ['{projectRoot}/test-output'],
        options: {},
        configurations: {
            ci: { coverage: true },
        },
    };
}

export function setVitestTestTarget(tree: Tree, projectName: string): void {
    const configuration = readProjectConfiguration(tree, projectName);
    updateProjectConfiguration(tree, projectName, {
        ...configuration,
        targets: { ...configuration.targets, test: buildVitestTestTarget() },
    });
}
