import type { Tree } from '@nx/devkit';

/** Роль библиотеки в слоистой архитектуре (ADR-0014). Приложения создаются другими генераторами. */
export type LibType = 'contracts' | 'core' | 'infra' | 'module' | 'tooling' | 'ui';

/** Среда выполнения проекта (ADR-0014). */
export type Platform = 'api' | 'native' | 'shared' | 'web';

/** Три обязательных тега проекта. */
export type ProjectTags = {
    platform: Platform;
    scope: string;
    type: LibType | 'app';
};

/** Опции генератора `@market/tooling:lib` (зеркало `schema.json`). */
export type LibGeneratorSchema = {
    name: string;
    type: LibType;
    description?: string;
    directory?: string;
    importPath?: string;
    platform?: Platform;
    scope?: string;
    skipFormat?: boolean;
};

/** Опции после нормализации: все значения вычислены и проверены. */
export type NormalizedLibOptions = {
    className: string;
    description: string;
    directory: string;
    fileName: string;
    importPath: string;
    name: string;
    platform: Platform;
    propertyName: string;
    scope: string;
    skipFormat: boolean;
    tags: string[];
    type: LibType;
};

/** Подстановки для шаблонов `files/` генератора `lib`. */
export type LibTemplateSubstitutions = NormalizedLibOptions & {
    coverageThreshold: number;
    generator: string;
    offsetFromRoot: string;
    testEnvironment: 'jsdom' | 'node';
    tmpl: '';
};

/** Маркер «проект создан генератором» в `project.json` → `metadata`. */
export type GeneratedProjectMetadata = {
    description?: string;
    generator: string;
};

/**
 * Опции executor-а `@market/tooling:vitest` (зеркало `schema.json`).
 * Принимает флаги в стиле Jest из приёмочных команд эпиков (`--testPathPattern`) и переводит их в аргументы Vitest.
 */
export type VitestExecutorSchema = {
    bail?: number;
    configFile?: string;
    coverage?: boolean;
    passWithNoTests?: boolean;
    reporters?: string[];
    testNamePattern?: string;
    testPathPattern?: string | string[];
    update?: boolean;
    watch?: boolean;
};

/** Запуск дочернего процесса: подменяется в тестах executor-а. */
export type ProcessRunner = (command: string, args: string[], cwd: string) => Promise<number>;

/** Шаг пост-обработки дерева после официального генератора Nx. */
export type TreeStep = (tree: Tree) => void;
