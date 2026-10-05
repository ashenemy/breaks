import { generateFiles, joinPathFragments, offsetFromRoot, type Tree, updateJson } from '@nx/devkit';

import type { LibTemplateSubstitutions, NormalizedLibOptions } from '../@types';
import { COVERAGE_THRESHOLD, LIB_GENERATOR } from './constants';

/** Файлы официального генератора, которые заменяются шаблонами воркспейса. */
const REPLACED_FILES = ['README.md', 'vitest.config.mts'];

/** Типы окружения тестов без глобальных переменных Vitest: тесты импортируют API явно. */
const SPEC_TYPES = ['node', 'vitest/importMeta', 'vite/client'];

type TsConfigSpec = {
    compilerOptions?: Record<string, unknown>;
    include?: string[];
};

/**
 * Приводит проект к структуре воркспейса (01-architecture.md, раздел 4):
 * `src/@types/index.ts`, `src/lib/`, `src/index.ts` с именованными экспортами, тесты в `test/`,
 * README модуля, Vitest с порогом покрытия.
 */
export function applyStandardStructure(tree: Tree, options: NormalizedLibOptions, templatesDir: string): void {
    const { directory, fileName, projectName } = options;

    for (const relativePath of [
        ...REPLACED_FILES,
        `src/lib/${projectName}.spec.ts`,
        `src/lib/${projectName}.ts`,
        `src/lib/${fileName}.spec.ts`,
    ]) {
        const filePath = joinPathFragments(directory, relativePath);
        if (tree.exists(filePath)) {
            tree.delete(filePath);
        }
    }

    const substitutions: LibTemplateSubstitutions = {
        ...options,
        coverageThreshold: COVERAGE_THRESHOLD,
        generator: LIB_GENERATOR,
        offsetFromRoot: offsetFromRoot(directory),
        testEnvironment: 'node',
        tmpl: '',
    };
    generateFiles(tree, templatesDir, directory, substitutions);

    updateJson<TsConfigSpec, TsConfigSpec>(tree, joinPathFragments(directory, 'tsconfig.spec.json'), (json) => ({
        ...json,
        compilerOptions: { ...json.compilerOptions, types: SPEC_TYPES },
        include: ['vitest.config.mts', 'test/**/*.ts'],
    }));
}
