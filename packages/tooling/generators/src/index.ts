export type {
    GeneratedProjectMetadata,
    LibGeneratorSchema,
    LibTemplateSubstitutions,
    LibType,
    NormalizedLibOptions,
    Platform,
    ProjectTags,
    TreeStep,
} from './@types';
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
} from './lib/constants';
export { LibGenerator } from './lib/lib-generator';
export { assertKebabCase, buildTags } from './lib/naming';
export { normalizeLibOptions } from './lib/normalize-lib-options';
export { markGeneratedProject, readGeneratedProjectMetadata } from './lib/project-marker';
