export type {
    GeneratedProjectMetadata,
    LibGeneratorSchema,
    LibTemplateSubstitutions,
    LibType,
    NormalizedLibOptions,
    Platform,
    ProcessRunner,
    ProjectTags,
    TreeStep,
    VitestExecutorSchema,
} from './@types';
export { vitestExecutor } from './executors/vitest/executor';
export { libGenerator } from './generators/lib/generator';
export {
    COVERAGE_THRESHOLD,
    DEFAULT_PLATFORM,
    DEFAULT_SCOPE,
    GENERATOR_COLLECTION,
    IMPORT_SCOPE,
    LIB_GENERATOR,
    LIB_TYPES,
    PLATFORMS,
    VITEST_EXECUTOR,
} from './lib/constants';
export { LibGenerator } from './lib/lib-generator';
export { assertKebabCase, buildTags } from './lib/naming';
export { normalizeLibOptions } from './lib/normalize-lib-options';
export { markGeneratedProject, readGeneratedProjectMetadata } from './lib/project-marker';
export { buildVitestTestTarget, setVitestTestTarget } from './lib/test-target';
export { buildVitestArgs } from './lib/vitest-args';
export { VitestRunner } from './lib/vitest-runner';
